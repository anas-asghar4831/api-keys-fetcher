import { Octokit } from '@octokit/rest';
import { RepoReference, SearchQuery } from '../providers/types';
import {
  GITHUB_MAX_RESULTS_PER_PAGE,
  GITHUB_PAGE_DELAY_MS,
  GITHUB_MAX_PAGES,
} from '../utils/constants';
import { createLogger } from '../utils/logger';

const log = createLogger('github');

export type SearchEventCallback = (type: string, message: string, data?: Record<string, unknown>) => void;

/**
 * GitHub search result item
 */
interface GitHubSearchItem {
  name: string;
  path: string;
  sha: string;
  url: string;
  html_url: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: { login: string };
    html_url: string;
    description: string | null;
    default_branch: string;
  };
}

/**
 * GitHub search service for finding exposed API keys
 */
export class GitHubSearchService {
  private octokit: Octokit;
  private onEvent?: SearchEventCallback;

  constructor(token: string, onEvent?: SearchEventCallback) {
    this.octokit = new Octokit({
      auth: token,
      userAgent: 'UnsecuredAPIKeys-Scraper/1.0',
    });
    this.onEvent = onEvent;
  }

  private emit(type: string, message: string, data?: Record<string, unknown>) {
    if (this.onEvent) {
      this.onEvent(type, message, data);
    }
  }

  /**
   * Search GitHub for code matching the query
   */
  async search(query: SearchQuery): Promise<{
    results: Partial<RepoReference>[];
    totalCount: number;
  }> {
    const results: Partial<RepoReference>[] = [];
    let page = 1;
    let totalCount = 0;

    log.info(`Starting search for query: "${query.query}"`);

    try {
      while (true) {
        log.debug(`Fetching page ${page}...`, { query: query.query, page });
        this.emit('page_fetching', `Fetching page ${page}...`, { page, query: query.query });

        const response = await this.octokit.search.code({
          q: query.query,
          per_page: GITHUB_MAX_RESULTS_PER_PAGE,
          page,
        });

        if (page === 1) {
          totalCount = response.data.total_count;
          log.info(`Total results found: ${totalCount}`, { totalCount });
        }

        const items = response.data.items as GitHubSearchItem[];
        log.debug(`Page ${page}: received ${items?.length || 0} items`, { page, items: items?.length || 0 });
        this.emit('page_fetched', `Page ${page}: ${items?.length || 0} files found`, { page, items: items?.length || 0 });

        if (!items || items.length === 0) {
          log.debug(`No more items, stopping pagination`);
          break;
        }

        for (const item of items) {
          results.push(this.mapToRepoReference(item, query.$id || ''));
        }

        log.debug(`Total collected so far: ${results.length}`, { collected: results.length });

        // Check if we've reached the end
        if (items.length < GITHUB_MAX_RESULTS_PER_PAGE) {
          log.debug(`Last page reached (${items.length} < ${GITHUB_MAX_RESULTS_PER_PAGE})`);
          break;
        }

        // Check if we've hit GitHub's 1000 result limit
        if (page >= GITHUB_MAX_PAGES) {
          log.warn(`GitHub limit: can only access first ${GITHUB_MAX_PAGES * GITHUB_MAX_RESULTS_PER_PAGE} results`);
          break;
        }

        // Wait between pages to avoid rate limiting
        log.debug(`Waiting ${GITHUB_PAGE_DELAY_MS}ms before next page...`);
        this.emit('info', `Rate limit pause: ${GITHUB_PAGE_DELAY_MS / 1000}s before page ${page + 1}...`, { delay: GITHUB_PAGE_DELAY_MS });
        await this.sleep(GITHUB_PAGE_DELAY_MS);
        page++;
      }
    } catch (error) {
      // Handle rate limit
      if (this.isRateLimitError(error)) {
        const resetTime = this.getRateLimitReset(error);
        log.error(`Rate limited! Reset at: ${resetTime}`, { resetTime });
        throw new Error(`Rate limited until ${resetTime}`);
      }

      // Handle GitHub's 1000 result limit (422 error)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Cannot access beyond') || errorMessage.includes('1000')) {
        log.warn(`GitHub 1000 result limit reached, returning collected results`);
        // Return what we have instead of throwing
        return { results, totalCount };
      }

      log.error(`Search error: ${errorMessage}`);
      throw error;
    }

    log.info(`Search complete: ${results.length} files from ${page} pages`, {
      totalResults: results.length,
      pages: page,
      totalCount
    });

    return { results, totalCount };
  }

  /**
   * Fetch raw file content from GitHub
   */
  async fetchFileContent(ref: Partial<RepoReference>): Promise<string | null> {
    if (!ref.repoOwner || !ref.repoName || !ref.filePath) {
      log.warn(`Missing file info`, { repoOwner: ref.repoOwner, repoName: ref.repoName, filePath: ref.filePath });
      return null;
    }

    const fileId = `${ref.repoOwner}/${ref.repoName}/${ref.filePath}`;
    log.debug(`Fetching file: ${fileId}`);

    try {
      // Try main branch first
      const branches = [ref.branch || 'main', 'master'];

      for (const branch of branches) {
        try {
          const url = `https://raw.githubusercontent.com/${ref.repoOwner}/${ref.repoName}/${branch}/${ref.filePath}`;
          log.debug(`Trying branch: ${branch}`, { url });

          const response = await fetch(url, {
            headers: {
              'User-Agent': 'UnsecuredAPIKeys-Scraper/1.0',
            },
          });

          if (response.ok) {
            const content = await response.text();
            log.debug(`File fetched: ${content.length} bytes`, { fileId, bytes: content.length });
            return content;
          } else {
            log.debug(`Branch ${branch} failed: ${response.status}`);
          }
        } catch (err) {
          log.debug(`Branch ${branch} error: ${err instanceof Error ? err.message : String(err)}`);
          continue;
        }
      }

      log.warn(`Could not fetch file from any branch: ${fileId}`);
      return null;
    } catch (err) {
      log.error(`Fetch error: ${fileId}`, { error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  /**
   * Map GitHub search result to RepoReference
   */
  private mapToRepoReference(
    item: GitHubSearchItem,
    searchQueryId: string
  ): Partial<RepoReference> {
    return {
      searchQueryId,
      provider: 'GitHub',
      repoOwner: item.repository.owner.login,
      repoName: item.repository.name,
      filePath: item.path,
      fileUrl: item.html_url,
      fileName: item.name,
      fileSha: item.sha,
      branch: item.repository.default_branch,
      repoUrl: item.repository.html_url,
      repoDescription: item.repository.description || undefined,
      foundUtc: new Date().toISOString(),
    };
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      return (error as { status: number }).status === 403;
    }
    return false;
  }

  /**
   * Get rate limit reset time from error
   */
  private getRateLimitReset(error: unknown): string {
    try {
      if (
        error &&
        typeof error === 'object' &&
        'response' in error
      ) {
        const response = (error as { response: { headers: { 'x-ratelimit-reset': string } } })
          .response;
        const resetTimestamp = parseInt(response.headers['x-ratelimit-reset'], 10);
        return new Date(resetTimestamp * 1000).toISOString();
      }
    } catch {
      // Ignore
    }
    return 'unknown';
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check rate limit status
   */
  async getRateLimitStatus(): Promise<{
    remaining: number;
    limit: number;
    reset: Date;
  }> {
    const response = await this.octokit.rateLimit.get();
    const searchLimit = response.data.resources.search;

    return {
      remaining: searchLimit.remaining,
      limit: searchLimit.limit,
      reset: new Date(searchLimit.reset * 1000),
    };
  }
}

/**
 * Create GitHub search service instance
 */
export function createGitHubSearchService(token: string, onEvent?: SearchEventCallback): GitHubSearchService {
  return new GitHubSearchService(token, onEvent);
}
