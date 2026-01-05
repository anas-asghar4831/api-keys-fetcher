import { RepoReference, SearchQuery } from '../providers/types';
import { createLogger } from '../utils/logger';
import { ApplicationSettingDB } from '../appwrite/database';

const log = createLogger('github-web');

export type SearchEventCallback = (type: string, message: string, data?: Record<string, unknown>) => void;

/**
 * GitHub web search result item (from internal API)
 * Actual format from code search endpoint
 */
interface GitHubWebSearchItem {
  path: string;              // File path: "src/config.ts"
  repo_nwo: string;          // "owner/repo" format
  ref_name?: string;         // "refs/heads/main"
  commit_sha?: string;
  blob_sha?: string;
  language_name?: string;
  line_number?: number;
  snippets?: Array<{
    lines: string[];
    starting_line_number: number;
    ending_line_number: number;
  }>;
}

interface GitHubWebSearchResponse {
  payload?: {
    results?: GitHubWebSearchItem[];
    result_count?: number;
    page_count?: number;
  };
  results?: GitHubWebSearchItem[];
  result_count?: number;
}

const GITHUB_COOKIES_KEY = 'github_session_cookies';

/**
 * GitHub web search service using session cookies
 * This uses the internal web search API with much higher rate limits
 */
export class GitHubWebSearchService {
  private cookies: string;
  private onEvent?: SearchEventCallback;

  constructor(cookies: string, onEvent?: SearchEventCallback) {
    this.cookies = cookies;
    this.onEvent = onEvent;
  }

  private emit(type: string, message: string, data?: Record<string, unknown>) {
    if (this.onEvent) {
      this.onEvent(type, message, data);
    }
  }

  /**
   * Search GitHub using the web search API
   */
  async search(query: SearchQuery, maxPages: number = 3): Promise<{
    results: Partial<RepoReference>[];
    totalCount: number;
  }> {
    const results: Partial<RepoReference>[] = [];
    let totalCount = 0;

    log.info(`Starting web search for query: "${query.query}"`);

    try {
      for (let page = 1; page <= maxPages; page++) {
        log.debug(`Fetching page ${page}...`, { query: query.query, page });
        this.emit('page_fetching', `Fetching page ${page}...`, { page, query: query.query });

        const searchUrl = `https://github.com/search?q=${encodeURIComponent(query.query)}&type=code&p=${page}`;

        const response = await fetch(searchUrl, {
          headers: {
            'accept': 'application/json',
            'x-requested-with': 'XMLHttpRequest',
            'cookie': this.cookies,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('GitHub cookies expired or invalid');
          }
          throw new Error(`GitHub web search failed: ${response.status}`);
        }

        const data: GitHubWebSearchResponse = await response.json();

        // Handle both response formats
        const items = data.payload?.results || data.results || [];
        const resultCount = data.payload?.result_count || data.result_count || 0;

        if (page === 1) {
          totalCount = resultCount;
          log.info(`Total results found: ${totalCount}`, { totalCount });
        }

        log.debug(`Page ${page}: received ${items.length} items`, { page, items: items.length });
        this.emit('page_fetched', `Page ${page}: ${items.length} files found`, { page, items: items.length });

        if (items.length === 0) {
          log.debug(`No more items, stopping pagination`);
          break;
        }

        for (const item of items) {
          const mapped = this.mapToRepoReference(item, query.$id || '');
          if (mapped) {
            results.push(mapped);
          }
        }

        log.debug(`Total collected so far: ${results.length}`, { collected: results.length });

        // Delay between pages to avoid rate limits
        if (page < maxPages && items.length > 0) {
          await this.sleep(2000);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Web search error: ${message}`);
      throw error;
    }

    log.info(`Web search complete: ${results.length} files`, {
      totalResults: results.length,
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
   * Map GitHub web search result to RepoReference
   * Uses repo_nwo format: "owner/repo"
   */
  private mapToRepoReference(
    item: GitHubWebSearchItem,
    searchQueryId: string
  ): Partial<RepoReference> | null {
    try {
      // Parse repo_nwo: "owner/repo"
      if (!item.repo_nwo || !item.path) {
        log.debug('Skipping item - missing repo_nwo or path');
        return null;
      }

      const [repoOwner, repoName] = item.repo_nwo.split('/');
      if (!repoOwner || !repoName) {
        log.debug('Skipping item - invalid repo_nwo format', { repo_nwo: item.repo_nwo });
        return null;
      }

      // Extract branch from ref_name: "refs/heads/main" -> "main"
      let branch = 'main';
      if (item.ref_name) {
        const refMatch = item.ref_name.match(/refs\/heads\/(.+)/);
        if (refMatch) {
          branch = refMatch[1];
        }
      }

      const filePath = item.path;
      const fileName = filePath.split('/').pop() || filePath;

      return {
        searchQueryId,
        provider: 'GitHub',
        repoOwner,
        repoName,
        filePath,
        fileUrl: `https://github.com/${repoOwner}/${repoName}/blob/${branch}/${filePath}`,
        fileName,
        branch,
        repoUrl: `https://github.com/${repoOwner}/${repoName}`,
        lineNumber: item.line_number,
        foundUtc: new Date().toISOString(),
      };
    } catch (err) {
      log.debug('Failed to map item', { error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Check if GitHub cookies are available
 */
export async function hasGitHubCookies(): Promise<boolean> {
  const cookies = await ApplicationSettingDB.get(GITHUB_COOKIES_KEY);
  return !!cookies;
}

/**
 * Get GitHub cookies
 */
export async function getGitHubCookies(): Promise<string | null> {
  return ApplicationSettingDB.get(GITHUB_COOKIES_KEY);
}

/**
 * Create GitHub web search service instance
 */
export async function createGitHubWebSearchService(
  onEvent?: SearchEventCallback
): Promise<GitHubWebSearchService | null> {
  const cookies = await getGitHubCookies();

  if (!cookies) {
    return null;
  }

  return new GitHubWebSearchService(cookies, onEvent);
}
