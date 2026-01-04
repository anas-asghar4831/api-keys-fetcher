import { ApiKeyDB, RepoReferenceDB, SearchQueryDB, SearchProviderTokenDB } from '../appwrite/database';
import { createGitHubSearchService } from './github-search';
import { ProviderRegistry } from '../providers/registry';
import { ApiKey, RepoReference, ApiStatusEnum, SearchProviderEnum } from '../providers/types';
import { createLogger } from '../utils/logger';
import { ScraperEvent, ScraperProgress, createEvent, createInitialProgress } from '../utils/scraper-events';
import { MAX_CONCURRENT_FILES, MAX_FILES_PER_RUN } from '../utils/constants';

export type EventCallback = (event: ScraperEvent, progress: ScraperProgress) => void;

const log = createLogger('scraper');

/**
 * Run tasks with concurrency limit
 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const promise = fn(items[i], i).then((result) => {
      results[i] = result;
    });

    const e: Promise<void> = promise.then(() => {
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

export class StreamingScraperService {
  private progress: ScraperProgress;
  private onEvent: EventCallback;

  constructor(onEvent: EventCallback) {
    this.progress = createInitialProgress();
    this.onEvent = onEvent;
  }

  private emit(event: ScraperEvent) {
    this.progress.events.push(event);
    this.onEvent(event, { ...this.progress });

    // Also log to console
    const logData = event.data ? { ...event.data } : undefined;
    switch (event.type) {
      case 'error':
      case 'rate_limited':
        log.error(event.message, logData);
        break;
      case 'key_found':
      case 'key_saved':
        log.info(event.message, logData);
        break;
      default:
        log.debug(event.message, logData);
    }
  }

  async run(): Promise<ScraperProgress> {
    try {
      // Start
      this.emit(createEvent('start', 'Scraper starting...'));

      // 1. Get search query
      const query = await SearchQueryDB.getNextDue();
      if (!query) {
        this.emit(createEvent('error', 'No search queries available'));
        this.progress.status = 'error';
        return this.progress;
      }

      this.progress.currentQuery = query.query;
      this.emit(createEvent('query_selected', `Selected query: "${query.query}"`, { queryId: query.$id }));

      // 2. Get GitHub token
      const tokenRecord = await SearchProviderTokenDB.getGitHubToken();
      if (!tokenRecord?.token) {
        this.emit(createEvent('error', 'No GitHub token configured'));
        this.progress.status = 'error';
        return this.progress;
      }

      // 3. Update query timestamp
      await SearchQueryDB.update(query.$id!, { lastSearchUtc: new Date().toISOString() });

      // 4. Search GitHub
      this.emit(createEvent('search_started', `Searching GitHub for: "${query.query}"`));

      const githubService = createGitHubSearchService(tokenRecord.token);
      const { results, totalCount } = await githubService.search(query);

      this.progress.totalResults = totalCount;
      this.progress.totalFiles = results.length;
      this.emit(createEvent('search_complete', `Found ${totalCount} total results, processing ${results.length} files`, {
        totalCount,
        filesToProcess: results.length,
      }));

      // 5. Update query results count
      await SearchQueryDB.update(query.$id!, { searchResultsCount: totalCount });

      // 6. Limit files per run
      const filesToProcess = results.slice(0, MAX_FILES_PER_RUN);
      this.progress.totalFiles = filesToProcess.length;

      if (results.length > MAX_FILES_PER_RUN) {
        this.emit(createEvent('file_processing', `Processing first ${MAX_FILES_PER_RUN} of ${results.length} files (run again for more)`, {
          limited: true,
          total: results.length,
          processing: MAX_FILES_PER_RUN,
        }));
      }

      // 7. Process files in parallel with concurrency limit
      this.emit(createEvent('file_processing', `Processing ${filesToProcess.length} files in parallel (max ${MAX_CONCURRENT_FILES} concurrent)...`, {
        total: filesToProcess.length,
        concurrency: MAX_CONCURRENT_FILES,
      }));

      await runWithConcurrency(filesToProcess, MAX_CONCURRENT_FILES, async (ref, i) => {
        try {
          const extracted = await this.processFile(ref, githubService, query.$id!);

          this.progress.processedFiles++;
          this.emit(createEvent('file_processed', `[${this.progress.processedFiles}/${filesToProcess.length}] ${ref.repoOwner}/${ref.repoName}: ${extracted.newKeys} new, ${extracted.duplicates} dupe`, {
            index: this.progress.processedFiles,
            total: filesToProcess.length,
            file: ref.filePath,
            newKeys: extracted.newKeys,
            duplicates: extracted.duplicates,
          }));

          return extracted;
        } catch (err) {
          this.progress.errors++;
          this.progress.processedFiles++;
          const message = err instanceof Error ? err.message : String(err);
          this.emit(createEvent('error', `Error: ${ref.filePath}: ${message}`, { file: ref.filePath }));
          return { newKeys: 0, duplicates: 0 };
        }
      });

      // 8. Update token last used
      await SearchProviderTokenDB.update(tokenRecord.$id!, { lastUsedUtc: new Date().toISOString() });

      // Complete
      this.progress.status = 'complete';
      this.emit(createEvent('complete', `Scraping complete: ${this.progress.newKeys} new keys, ${this.progress.duplicates} duplicates, ${this.progress.errors} errors`, {
        newKeys: this.progress.newKeys,
        duplicates: this.progress.duplicates,
        errors: this.progress.errors,
        query: query.query,
      }));

      return this.progress;

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('Rate limit')) {
        this.emit(createEvent('rate_limited', message));
      } else {
        this.emit(createEvent('error', `Scraper failed: ${message}`));
      }

      this.progress.status = 'error';
      return this.progress;
    }
  }

  private async processFile(
    ref: Partial<RepoReference>,
    githubService: ReturnType<typeof createGitHubSearchService>,
    searchQueryId: string
  ): Promise<{ newKeys: number; duplicates: number }> {
    let newKeys = 0;
    let duplicates = 0;

    // Fetch file content
    const content = await githubService.fetchFileContent(ref);
    if (!content) {
      return { newKeys: 0, duplicates: 0 };
    }

    // Extract keys
    const extractedKeys = ProviderRegistry.extractKeysFromText(content);

    for (const { key, provider } of extractedKeys) {
      // Check if exists
      const exists = await ApiKeyDB.exists(key);

      if (exists) {
        duplicates++;
        this.progress.duplicates++;
        this.emit(createEvent('key_duplicate', `Duplicate key: ${provider.providerName}`, {
          provider: provider.providerName,
          keyPrefix: key.substring(0, 10) + '...',
        }));
        continue;
      }

      // Create new key
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
      this.progress.newKeys++;

      this.emit(createEvent('key_saved', `New ${provider.providerName} key saved`, {
        provider: provider.providerName,
        keyPrefix: key.substring(0, 10) + '...',
        repo: `${ref.repoOwner}/${ref.repoName}`,
      }));
    }

    return { newKeys, duplicates };
  }
}

export function createStreamingScraper(onEvent: EventCallback): StreamingScraperService {
  return new StreamingScraperService(onEvent);
}
