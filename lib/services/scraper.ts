import {
  ApiKeyDB,
  RepoReferenceDB,
  SearchQueryDB,
  SearchProviderTokenDB,
} from '../appwrite/database';
import { createGitHubSearchService } from './github-search';
import { ProviderRegistry } from '../providers/registry';
import {
  ApiKey,
  RepoReference,
  ApiStatusEnum,
  SearchProviderEnum,
} from '../providers/types';

/**
 * Scraper result
 */
export interface ScraperResult {
  status: 'success' | 'no_query' | 'no_token' | 'error';
  newKeys?: number;
  duplicates?: number;
  totalResults?: number;
  error?: string;
  queryUsed?: string;
}

/**
 * Scraper service for discovering API keys from GitHub
 */
export class ScraperService {
  /**
   * Run a single scraping cycle
   */
  async runScrapingCycle(): Promise<ScraperResult> {
    try {
      // 1. Get the next search query due for execution
      const query = await SearchQueryDB.getNextDue();
      if (!query) {
        return { status: 'no_query' };
      }

      // 2. Get GitHub token
      const tokenRecord = await SearchProviderTokenDB.getGitHubToken();
      if (!tokenRecord || !tokenRecord.token) {
        return { status: 'no_token' };
      }

      // 3. Update query's last search time
      await SearchQueryDB.update(query.$id!, {
        lastSearchUtc: new Date().toISOString(),
      });

      // 4. Search GitHub
      const githubService = createGitHubSearchService(tokenRecord.token);
      const { results, totalCount } = await githubService.search(query);

      // 5. Update query with results count
      await SearchQueryDB.update(query.$id!, {
        searchResultsCount: totalCount,
      });

      // 6. Process results
      let newKeys = 0;
      let duplicates = 0;

      for (const ref of results) {
        const extracted = await this.processResult(
          ref,
          githubService,
          query.$id!
        );
        newKeys += extracted.newKeys;
        duplicates += extracted.duplicates;
      }

      // 7. Update token last used
      await SearchProviderTokenDB.update(tokenRecord.$id!, {
        lastUsedUtc: new Date().toISOString(),
      });

      return {
        status: 'success',
        newKeys,
        duplicates,
        totalResults: totalCount,
        queryUsed: query.query,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Scraper error:', message);
      return {
        status: 'error',
        error: message,
      };
    }
  }

  /**
   * Process a single search result
   */
  private async processResult(
    ref: Partial<RepoReference>,
    githubService: ReturnType<typeof createGitHubSearchService>,
    searchQueryId: string
  ): Promise<{ newKeys: number; duplicates: number }> {
    let newKeys = 0;
    let duplicates = 0;

    try {
      // Fetch file content
      const content = await githubService.fetchFileContent(ref);
      if (!content) {
        return { newKeys: 0, duplicates: 0 };
      }

      // Extract keys using all provider patterns
      const extractedKeys = ProviderRegistry.extractKeysFromText(content);

      for (const { key, provider } of extractedKeys) {
        // Check if key already exists
        const exists = await ApiKeyDB.exists(key);

        if (exists) {
          duplicates++;
          continue;
        }

        // Create new API key record
        const now = new Date().toISOString();
        const newApiKey: Omit<ApiKey, '$id'> = {
          apiKey: key,
          status: ApiStatusEnum.Unverified,
          apiType: provider.apiType,
          searchProvider: SearchProviderEnum.GitHub,
          firstFoundUtc: now,
          lastFoundUtc: now,
          timesDisplayed: 0,
          errorCount: 0,
        };

        const createdKey = await ApiKeyDB.create(newApiKey);

        // Create repo reference
        const repoRef: Omit<RepoReference, '$id'> = {
          apiKeyId: createdKey.$id!,
          searchQueryId,
          repoUrl: ref.repoUrl || '',
          repoOwner: ref.repoOwner,
          repoName: ref.repoName,
          repoDescription: ref.repoDescription,
          fileUrl: ref.fileUrl || '',
          fileName: ref.fileName,
          filePath: ref.filePath,
          fileSha: ref.fileSha,
          branch: ref.branch,
          provider: 'GitHub',
          foundUtc: now,
        };

        await RepoReferenceDB.create(repoRef);
        newKeys++;

        console.log(`[Scraper] New ${provider.providerName} key found`);
      }
    } catch (error) {
      console.error('Error processing result:', error);
    }

    return { newKeys, duplicates };
  }

  /**
   * Initialize database with default search queries
   */
  async initialize(): Promise<void> {
    await SearchQueryDB.seedDefaults();
  }

  /**
   * Check if scraper is ready to run
   */
  async isReady(): Promise<{ ready: boolean; reason?: string }> {
    const hasToken = await SearchProviderTokenDB.hasGitHubToken();
    if (!hasToken) {
      return { ready: false, reason: 'No GitHub token configured' };
    }

    const query = await SearchQueryDB.getNextDue();
    if (!query) {
      return { ready: false, reason: 'No queries due for search' };
    }

    return { ready: true };
  }
}

/**
 * Create scraper service instance
 */
export function createScraperService(): ScraperService {
  return new ScraperService();
}
