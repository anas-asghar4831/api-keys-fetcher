import { ApiKeyDB, RepoReferenceDB, SearchQueryDB, SearchProviderTokenDB, ScraperRunDB } from '../appwrite/database';
import { createGitHubSearchService } from './github-search';
import { ProviderRegistry } from '../providers/registry';
import { ApiKey, RepoReference, ApiStatusEnum, SearchProviderEnum, ScraperRun, SearchQuery } from '../providers/types';
import { createLogger } from '../utils/logger';
import { ScraperEvent, ScraperProgress, createEvent, createInitialProgress } from '../utils/scraper-events';
import { MAX_CONCURRENT_FILES, MAX_FILES_PER_QUERY, MAX_CONCURRENT_QUERIES } from '../utils/constants';

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
  private progress!: ScraperProgress;
  private onEvent!: EventCallback;
  private runId: string | null = null;

  constructor(onEvent: EventCallback) {
    this.progress = createInitialProgress();
    this.onEvent = onEvent;
  }

  private async saveRun(): Promise<void> {
    try {
      const runData: Omit<ScraperRun, '$id'> = {
        status: this.progress.status,
        query: this.progress.currentQuery,
        totalResults: this.progress.totalResults,
        processedFiles: this.progress.processedFiles,
        totalFiles: this.progress.totalFiles,
        newKeys: this.progress.newKeys,
        duplicates: this.progress.duplicates,
        errors: this.progress.errors,
        events: JSON.stringify(this.progress.events),
        startedAt: this.progress.events[0]?.timestamp || new Date().toISOString(),
        completedAt: this.progress.status !== 'running' ? new Date().toISOString() : undefined,
      };

      if (this.runId) {
        await ScraperRunDB.update(this.runId, runData);
      } else {
        const created = await ScraperRunDB.create(runData);
        this.runId = created.$id || null;
      }

      // Clean up old runs (keep last 10)
      await ScraperRunDB.deleteOld(10);
    } catch (err) {
      log.error('Failed to save scraper run:', { error: err instanceof Error ? err.message : String(err) });
    }
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
    // Reset progress for each run
    this.progress = createInitialProgress();
    this.runId = null;

    try {
      // Start
      this.emit(createEvent('start', 'Scraper starting...'));
      await this.saveRun(); // Create initial run record

      // 1. Get ALL enabled search queries
      const queries = await SearchQueryDB.listEnabled();
      if (!queries || queries.length === 0) {
        this.emit(createEvent('error', 'No search queries available'));
        this.progress.status = 'error';
        return this.progress;
      }

      this.emit(createEvent('info', `Found ${queries.length} search queries to process in parallel (max ${MAX_CONCURRENT_QUERIES} concurrent)`));

      // 2. Get GitHub token
      const tokenRecord = await SearchProviderTokenDB.getGitHubToken();
      if (!tokenRecord?.token) {
        this.emit(createEvent('error', 'No GitHub token configured'));
        this.progress.status = 'error';
        return this.progress;
      }

      // 3. Process ALL queries in parallel with concurrency limit
      await runWithConcurrency(queries, MAX_CONCURRENT_QUERIES, async (query) => {
        try {
          await this.processQuery(query, tokenRecord.token);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes('Rate limit')) {
            this.emit(createEvent('rate_limited', `Query "${query.query}": ${message}`));
          } else {
            this.emit(createEvent('error', `Query "${query.query}" failed: ${message}`));
          }
          this.progress.errors++;
        }
      });

      // 4. Update token last used
      await SearchProviderTokenDB.update(tokenRecord.$id!, { lastUsedUtc: new Date().toISOString() });

      // Complete
      this.progress.status = 'complete';
      this.emit(createEvent('complete', `Scraping complete: ${queries.length} queries, ${this.progress.newKeys} new keys, ${this.progress.duplicates} duplicates, ${this.progress.errors} errors`, {
        queries: queries.length,
        newKeys: this.progress.newKeys,
        duplicates: this.progress.duplicates,
        errors: this.progress.errors,
      }));

      await this.saveRun(); // Save final run state
      return this.progress;

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('Rate limit')) {
        this.emit(createEvent('rate_limited', message));
      } else {
        this.emit(createEvent('error', `Scraper failed: ${message}`));
      }

      this.progress.status = 'error';
      await this.saveRun(); // Save error state
      return this.progress;
    }
  }

  /**
   * Process a single search query
   */
  private processQuery = async (query: SearchQuery, token: string): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const progress = self.progress;

    progress.currentQuery = query.query;
    self.emit(createEvent('query_selected', `Processing query: "${query.query}"`, { queryId: query.$id }));

    // Update query timestamp
    await SearchQueryDB.update(query.$id!, { lastSearchUtc: new Date().toISOString() });

    // Search GitHub
    self.emit(createEvent('search_started', `Searching GitHub for: "${query.query}"`));

    const githubService = createGitHubSearchService(token, (type, message, data) => {
      self.emit(createEvent(type as Parameters<typeof createEvent>[0], message, data));
    });

    const { results, totalCount } = await githubService.search(query);

    progress.totalResults += totalCount;
    self.emit(createEvent('search_complete', `"${query.query}": Found ${totalCount} results, processing ${Math.min(results.length, MAX_FILES_PER_QUERY)} files`, {
      query: query.query,
      totalCount,
      filesToProcess: Math.min(results.length, MAX_FILES_PER_QUERY),
    }));

    // Update query results count
    await SearchQueryDB.update(query.$id!, { searchResultsCount: totalCount });

    // Limit files per query
    const filesToProcess = results.slice(0, MAX_FILES_PER_QUERY);
    progress.totalFiles += filesToProcess.length;

    if (results.length > MAX_FILES_PER_QUERY) {
      self.emit(createEvent('info', `"${query.query}": Limited to ${MAX_FILES_PER_QUERY} of ${results.length} files`));
    }

    // Process files in parallel
    await runWithConcurrency(filesToProcess, MAX_CONCURRENT_FILES, async (ref) => {
      try {
        const extracted = await self.processFile(ref, githubService, query.$id!);

        progress.processedFiles++;
        if (extracted.newKeys > 0 || extracted.duplicates > 0) {
          self.emit(createEvent('file_processed', `${ref.repoOwner}/${ref.repoName}/${ref.fileName}: ${extracted.newKeys} new, ${extracted.duplicates} dupe`, {
            file: ref.filePath,
            newKeys: extracted.newKeys,
            duplicates: extracted.duplicates,
          }));
        }

        return extracted;
      } catch (err) {
        progress.errors++;
        progress.processedFiles++;
        const message = err instanceof Error ? err.message : String(err);
        self.emit(createEvent('error', `Error: ${ref.filePath}: ${message}`, { file: ref.filePath }));
        return { newKeys: 0, duplicates: 0 };
      }
    });

    self.emit(createEvent('info', `Query "${query.query}" complete`));
  }

  private processFile = async (
    ref: Partial<RepoReference>,
    githubService: ReturnType<typeof createGitHubSearchService>,
    searchQueryId: string
  ): Promise<{ newKeys: number; duplicates: number }> => {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const progress = self.progress;

    let newKeys = 0;
    let duplicates = 0;

    const fileId = `${ref.repoOwner}/${ref.repoName}/${ref.filePath}`;
    log.debug(`Processing file: ${fileId}`);

    // Emit file fetching event
    self.emit(createEvent('file_fetching', `Fetching: ${ref.repoOwner}/${ref.repoName}/${ref.fileName}`, {
      file: ref.filePath,
      repo: `${ref.repoOwner}/${ref.repoName}`,
    }));

    // Fetch file content
    const content = await githubService.fetchFileContent(ref);
    if (!content) {
      log.warn(`No content for file: ${fileId}`);
      self.emit(createEvent('warning', `No content: ${ref.fileName}`, { file: ref.filePath }));
      return { newKeys: 0, duplicates: 0 };
    }

    // Emit file fetched event
    self.emit(createEvent('file_fetched', `Fetched: ${ref.fileName} (${content.length} bytes)`, {
      file: ref.filePath,
      bytes: content.length,
    }));

    log.debug(`File content: ${content.length} bytes`, { fileId, bytes: content.length });

    // Extract keys
    const extractedKeys = ProviderRegistry.extractKeysFromText(content);
    log.info(`Found ${extractedKeys.length} potential keys in ${fileId}`, {
      fileId,
      keysFound: extractedKeys.length,
      providers: extractedKeys.map(k => k.provider.providerName)
    });

    // Emit key_found event if any keys were found
    if (extractedKeys.length > 0) {
      self.emit(createEvent('key_found', `Found ${extractedKeys.length} potential key(s) in ${ref.fileName}`, {
        file: ref.filePath,
        count: extractedKeys.length,
        providers: extractedKeys.map(k => k.provider.providerName),
      }));
    }

    for (const { key, provider } of extractedKeys) {
      log.debug(`Checking key: ${provider.providerName} - ${key.substring(0, 15)}...`);

      // Emit key checking event
      self.emit(createEvent('key_checking', `Checking: ${provider.providerName} key ${key.substring(0, 8)}...`, {
        provider: provider.providerName,
        keyPrefix: key.substring(0, 10) + '...',
      }));

      // Check if exists
      const exists = await ApiKeyDB.exists(key);

      if (exists) {
        duplicates++;
        progress.duplicates++;
        self.emit(createEvent('key_duplicate', `Duplicate key: ${provider.providerName}`, {
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
      progress.newKeys++;

      self.emit(createEvent('key_saved', `New ${provider.providerName} key saved`, {
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
