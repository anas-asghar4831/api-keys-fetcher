import { Client, Databases, Query } from 'node-appwrite';
import { Octokit } from '@octokit/rest';

// Constants
const DATABASE_ID = 'main';
const COLLECTIONS = {
  API_KEYS: 'api_keys',
  REPO_REFERENCES: 'repo_references',
  SEARCH_QUERIES: 'search_queries',
  SEARCH_PROVIDER_TOKENS: 'search_provider_tokens',
};

const MAX_CONCURRENT_QUERIES = 3;
const MAX_CONCURRENT_FILES = 10;
const MAX_FILES_PER_QUERY = 30;
const GITHUB_MAX_RESULTS_PER_PAGE = 100;
const GITHUB_MAX_PAGES = 10;
const GITHUB_PAGE_DELAY_MS = 6000;

// Provider patterns for key extraction
const PROVIDER_PATTERNS = [
  { name: 'OpenAI', pattern: /sk-[a-zA-Z0-9]{20,}T3BlbkFJ[a-zA-Z0-9]{20,}/g, apiType: 'OpenAI' },
  { name: 'OpenAI-Project', pattern: /sk-proj-[a-zA-Z0-9_-]{80,}/g, apiType: 'OpenAI' },
  { name: 'OpenAI-Service', pattern: /sk-svcacct-[a-zA-Z0-9_-]{80,}/g, apiType: 'OpenAI' },
  { name: 'Anthropic', pattern: /sk-ant-api\d{2}-[a-zA-Z0-9_-]{93}/g, apiType: 'Anthropic' },
  { name: 'Google', pattern: /AIzaSy[a-zA-Z0-9_-]{33}/g, apiType: 'Google' },
  { name: 'OpenRouter', pattern: /sk-or-v1-[a-f0-9]{64}/g, apiType: 'OpenRouter' },
  { name: 'Groq', pattern: /gsk_[a-zA-Z0-9]{52}/g, apiType: 'Groq' },
  { name: 'Mistral', pattern: /[a-zA-Z0-9]{32}/g, apiType: 'Mistral' },
  { name: 'Cohere', pattern: /[a-zA-Z0-9]{40}/g, apiType: 'Cohere' },
  { name: 'HuggingFace', pattern: /hf_[a-zA-Z0-9]{34}/g, apiType: 'HuggingFace' },
  { name: 'Replicate', pattern: /r8_[a-zA-Z0-9]{37}/g, apiType: 'Replicate' },
  { name: 'Fireworks', pattern: /fw_[a-zA-Z0-9]{42}/g, apiType: 'Fireworks' },
  { name: 'Together', pattern: /[a-f0-9]{64}/g, apiType: 'Together' },
  { name: 'Perplexity', pattern: /pplx-[a-f0-9]{48}/g, apiType: 'Perplexity' },
  { name: 'DeepSeek', pattern: /sk-[a-f0-9]{32}/g, apiType: 'DeepSeek' },
  { name: 'xAI', pattern: /xai-[a-zA-Z0-9]{48}/g, apiType: 'xAI' },
];

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Run tasks with concurrency limit
async function runWithConcurrency(items, limit, fn) {
  const results = [];
  const executing = [];

  for (let i = 0; i < items.length; i++) {
    const promise = fn(items[i], i).then((result) => {
      results[i] = result;
    });

    const e = promise.then(() => {
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

// Extract keys from text
function extractKeysFromText(text) {
  const keys = [];
  for (const provider of PROVIDER_PATTERNS) {
    const matches = text.match(provider.pattern) || [];
    for (const key of matches) {
      // Skip short matches (likely false positives)
      if (key.length < 20) continue;
      keys.push({ key, provider: provider.name, apiType: provider.apiType });
    }
  }
  return keys;
}

// Main function
export default async ({ req, res, log, error }) => {
  const startTime = Date.now();
  log('Scheduled scraper starting...');

  try {
    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_FUNCTION_API_KEY);

    const databases = new Databases(client);

    // Get GitHub token
    log('Fetching GitHub token...');
    const tokenResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.SEARCH_PROVIDER_TOKENS,
      [Query.equal('provider', 'GitHub'), Query.limit(1)]
    );

    if (!tokenResult.documents.length || !tokenResult.documents[0].token) {
      error('No GitHub token configured');
      return res.json({ success: false, error: 'No GitHub token configured' });
    }

    const githubToken = tokenResult.documents[0].token;
    const tokenDocId = tokenResult.documents[0].$id;

    // Get enabled search queries
    log('Fetching search queries...');
    const queriesResult = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.SEARCH_QUERIES,
      [Query.equal('enabled', true), Query.limit(100)]
    );

    const queries = queriesResult.documents;
    if (!queries.length) {
      log('No enabled search queries');
      return res.json({ success: true, message: 'No enabled search queries' });
    }

    log(`Processing ${queries.length} queries (max ${MAX_CONCURRENT_QUERIES} concurrent)`);

    // Initialize Octokit
    const octokit = new Octokit({ auth: githubToken });

    // Stats
    let totalNewKeys = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;
    let totalFiles = 0;

    // Process queries in parallel
    await runWithConcurrency(queries, MAX_CONCURRENT_QUERIES, async (query) => {
      try {
        log(`Processing query: "${query.query}"`);

        // Update query timestamp
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.SEARCH_QUERIES,
          query.$id,
          { lastSearchUtc: new Date().toISOString() }
        );

        // Search GitHub
        const searchResults = [];
        let page = 1;
        let totalCount = 0;

        while (page <= GITHUB_MAX_PAGES) {
          try {
            const response = await octokit.search.code({
              q: query.query,
              per_page: GITHUB_MAX_RESULTS_PER_PAGE,
              page,
            });

            if (page === 1) {
              totalCount = response.data.total_count;
              log(`Query "${query.query}": ${totalCount} total results`);
            }

            if (!response.data.items.length) break;

            for (const item of response.data.items) {
              searchResults.push({
                repoOwner: item.repository.owner.login,
                repoName: item.repository.name,
                repoUrl: item.repository.html_url,
                repoDescription: item.repository.description,
                fileName: item.name,
                filePath: item.path,
                fileUrl: item.html_url,
                fileSha: item.sha,
                branch: item.repository.default_branch,
              });
            }

            if (searchResults.length >= MAX_FILES_PER_QUERY) break;
            if (response.data.items.length < GITHUB_MAX_RESULTS_PER_PAGE) break;

            page++;
            await sleep(GITHUB_PAGE_DELAY_MS);
          } catch (err) {
            if (err.status === 403) {
              error(`Rate limited on query "${query.query}"`);
              break;
            }
            throw err;
          }
        }

        // Update query results count
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.SEARCH_QUERIES,
          query.$id,
          { searchResultsCount: totalCount }
        );

        // Limit files
        const filesToProcess = searchResults.slice(0, MAX_FILES_PER_QUERY);
        totalFiles += filesToProcess.length;

        // Process files
        await runWithConcurrency(filesToProcess, MAX_CONCURRENT_FILES, async (ref) => {
          try {
            // Fetch file content
            const contentResponse = await octokit.repos.getContent({
              owner: ref.repoOwner,
              repo: ref.repoName,
              path: ref.filePath,
            });

            if (contentResponse.data.type !== 'file' || !contentResponse.data.content) {
              return;
            }

            const content = Buffer.from(contentResponse.data.content, 'base64').toString('utf-8');

            // Extract keys
            const extractedKeys = extractKeysFromText(content);

            for (const { key, provider, apiType } of extractedKeys) {
              // Check if key exists
              const existingKeys = await databases.listDocuments(
                DATABASE_ID,
                COLLECTIONS.API_KEYS,
                [Query.equal('apiKey', key), Query.limit(1)]
              );

              if (existingKeys.documents.length > 0) {
                totalDuplicates++;
                continue;
              }

              // Create new key
              const now = new Date().toISOString();
              const createdKey = await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.API_KEYS,
                'unique()',
                {
                  apiKey: key,
                  status: 'Unverified',
                  apiType,
                  searchProvider: 'GitHub',
                  firstFoundUtc: now,
                  lastFoundUtc: now,
                  timesDisplayed: 0,
                  errorCount: 0,
                }
              );

              // Create repo reference
              await databases.createDocument(
                DATABASE_ID,
                COLLECTIONS.REPO_REFERENCES,
                'unique()',
                {
                  apiKeyId: createdKey.$id,
                  searchQueryId: query.$id,
                  repoUrl: ref.repoUrl || '',
                  repoOwner: ref.repoOwner,
                  repoName: ref.repoName,
                  repoDescription: ref.repoDescription || '',
                  fileUrl: ref.fileUrl || '',
                  fileName: ref.fileName,
                  filePath: ref.filePath,
                  fileSha: ref.fileSha,
                  branch: ref.branch,
                  provider: 'GitHub',
                  foundUtc: now,
                }
              );

              totalNewKeys++;
              log(`New ${provider} key found in ${ref.repoOwner}/${ref.repoName}`);
            }
          } catch (err) {
            totalErrors++;
          }
        });

        log(`Query "${query.query}" complete`);
      } catch (err) {
        totalErrors++;
        error(`Query "${query.query}" failed: ${err.message}`);
      }
    });

    // Update token last used
    await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.SEARCH_PROVIDER_TOKENS,
      tokenDocId,
      { lastUsedUtc: new Date().toISOString() }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const summary = {
      success: true,
      duration: `${duration}s`,
      queries: queries.length,
      files: totalFiles,
      newKeys: totalNewKeys,
      duplicates: totalDuplicates,
      errors: totalErrors,
    };

    log(`Scraper complete: ${JSON.stringify(summary)}`);
    return res.json(summary);

  } catch (err) {
    error(`Scraper failed: ${err.message}`);
    return res.json({ success: false, error: err.message });
  }
};
