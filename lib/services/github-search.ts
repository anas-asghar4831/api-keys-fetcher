import { Octokit } from '@octokit/rest';
import { RepoReference, SearchQuery } from '../providers/types';
import {
  GITHUB_MAX_RESULTS_PER_PAGE,
  GITHUB_PAGE_DELAY_MS,
} from '../utils/constants';

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

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
      userAgent: 'UnsecuredAPIKeys-Scraper/1.0',
    });
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

    try {
      while (true) {
        const response = await this.octokit.search.code({
          q: query.query,
          per_page: GITHUB_MAX_RESULTS_PER_PAGE,
          page,
        });

        if (page === 1) {
          totalCount = response.data.total_count;
        }

        const items = response.data.items as GitHubSearchItem[];

        if (!items || items.length === 0) {
          break;
        }

        for (const item of items) {
          results.push(this.mapToRepoReference(item, query.$id || ''));
        }

        // Check if we've reached the end
        if (items.length < GITHUB_MAX_RESULTS_PER_PAGE) {
          break;
        }

        // Wait between pages to avoid rate limiting
        await this.sleep(GITHUB_PAGE_DELAY_MS);
        page++;
      }
    } catch (error) {
      // Handle rate limit
      if (this.isRateLimitError(error)) {
        const resetTime = this.getRateLimitReset(error);
        console.log(`Rate limited. Reset at: ${resetTime}`);
        throw new Error(`Rate limited until ${resetTime}`);
      }
      throw error;
    }

    return { results, totalCount };
  }

  /**
   * Fetch raw file content from GitHub
   */
  async fetchFileContent(ref: Partial<RepoReference>): Promise<string | null> {
    if (!ref.repoOwner || !ref.repoName || !ref.filePath) {
      return null;
    }

    try {
      // Try main branch first
      const branches = [ref.branch || 'main', 'master'];

      for (const branch of branches) {
        try {
          const url = `https://raw.githubusercontent.com/${ref.repoOwner}/${ref.repoName}/${branch}/${ref.filePath}`;
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'UnsecuredAPIKeys-Scraper/1.0',
            },
          });

          if (response.ok) {
            return await response.text();
          }
        } catch {
          // Try next branch
          continue;
        }
      }

      return null;
    } catch {
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
export function createGitHubSearchService(token: string): GitHubSearchService {
  return new GitHubSearchService(token);
}
