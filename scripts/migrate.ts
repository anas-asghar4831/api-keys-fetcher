import { Client, Databases, IndexType } from 'node-appwrite';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT = process.env.APPWRITE_PROJECT || process.env.NEXT_PUBLIC_APPWRITE_PROJECT;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'api-keys-fetcher';

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT || !APPWRITE_API_KEY) {
  console.error('Missing required environment variables:');
  console.error('- APPWRITE_ENDPOINT:', APPWRITE_ENDPOINT ? 'OK' : 'MISSING');
  console.error('- APPWRITE_PROJECT:', APPWRITE_PROJECT ? 'OK' : 'MISSING');
  console.error('- APPWRITE_API_KEY:', APPWRITE_API_KEY ? 'OK' : 'MISSING');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

// Collection IDs
const COLLECTIONS = {
  API_KEYS: 'api_keys',
  REPO_REFERENCES: 'repo_references',
  SEARCH_QUERIES: 'search_queries',
  SEARCH_PROVIDER_TOKENS: 'search_provider_tokens',
  APPLICATION_SETTINGS: 'application_settings',
};

async function createDatabase() {
  console.log(`\nCreating database: ${DATABASE_ID}`);
  try {
    await databases.create(DATABASE_ID, DATABASE_ID);
    console.log('  Database created successfully');
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err.code === 409) {
      console.log('  Database already exists, skipping...');
    } else {
      throw error;
    }
  }
}

async function createCollection(collectionId: string, name: string) {
  console.log(`\nCreating collection: ${collectionId}`);
  try {
    await databases.createCollection(DATABASE_ID, collectionId, name);
    console.log(`  Collection "${name}" created`);
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err.code === 409) {
      console.log(`  Collection "${name}" already exists, skipping...`);
    } else {
      throw error;
    }
  }
}

async function createAttribute(
  collectionId: string,
  type: 'string' | 'integer' | 'boolean' | 'datetime',
  key: string,
  options: {
    required?: boolean;
    default?: string | number | boolean | null;
    size?: number;
    array?: boolean;
  } = {}
) {
  const { required = false, size = 255, array = false } = options;

  try {
    switch (type) {
      case 'string':
        await databases.createStringAttribute(
          DATABASE_ID,
          collectionId,
          key,
          size,
          required,
          options.default as string | undefined,
          array
        );
        break;
      case 'integer':
        await databases.createIntegerAttribute(
          DATABASE_ID,
          collectionId,
          key,
          required,
          undefined, // min
          undefined, // max
          options.default as number | undefined,
          array
        );
        break;
      case 'boolean':
        await databases.createBooleanAttribute(
          DATABASE_ID,
          collectionId,
          key,
          required,
          options.default as boolean | undefined,
          array
        );
        break;
      case 'datetime':
        await databases.createDatetimeAttribute(
          DATABASE_ID,
          collectionId,
          key,
          required,
          options.default as string | undefined,
          array
        );
        break;
    }
    console.log(`    + ${key} (${type})`);
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err.code === 409) {
      console.log(`    ~ ${key} already exists`);
    } else {
      console.error(`    ! ${key} failed:`, err.message);
    }
  }
}

async function createIndex(
  collectionId: string,
  key: string,
  type: IndexType,
  attributes: string[],
  orders?: ('ASC' | 'DESC')[]
) {
  try {
    await databases.createIndex(
      DATABASE_ID,
      collectionId,
      key,
      type,
      attributes,
      orders
    );
    console.log(`    [idx] ${key}`);
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err.code === 409) {
      console.log(`    [idx] ${key} already exists`);
    } else {
      console.error(`    [idx] ${key} failed:`, err.message);
    }
  }
}

async function setupApiKeysCollection() {
  await createCollection(COLLECTIONS.API_KEYS, 'API Keys');

  console.log('  Adding attributes...');
  await createAttribute(COLLECTIONS.API_KEYS, 'string', 'apiKey', { required: true, size: 512 });
  await createAttribute(COLLECTIONS.API_KEYS, 'integer', 'status', { required: true });
  await createAttribute(COLLECTIONS.API_KEYS, 'integer', 'apiType', { required: true });
  await createAttribute(COLLECTIONS.API_KEYS, 'integer', 'searchProvider', { required: true });
  await createAttribute(COLLECTIONS.API_KEYS, 'datetime', 'lastCheckedUtc', { required: false });
  await createAttribute(COLLECTIONS.API_KEYS, 'datetime', 'firstFoundUtc', { required: true });
  await createAttribute(COLLECTIONS.API_KEYS, 'datetime', 'lastFoundUtc', { required: true });
  await createAttribute(COLLECTIONS.API_KEYS, 'integer', 'timesDisplayed', { required: false, default: 0 });
  await createAttribute(COLLECTIONS.API_KEYS, 'integer', 'errorCount', { required: false, default: 0 });

  // Wait for attributes to be available
  console.log('  Waiting for attributes to be ready...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('  Adding indexes...');
  await createIndex(COLLECTIONS.API_KEYS, 'idx_apiKey', IndexType.Unique, ['apiKey']);
  await createIndex(COLLECTIONS.API_KEYS, 'idx_status', IndexType.Key, ['status']);
  await createIndex(COLLECTIONS.API_KEYS, 'idx_apiType', IndexType.Key, ['apiType']);
  await createIndex(COLLECTIONS.API_KEYS, 'idx_firstFoundUtc', IndexType.Key, ['firstFoundUtc'], ['ASC']);
  await createIndex(COLLECTIONS.API_KEYS, 'idx_lastCheckedUtc', IndexType.Key, ['lastCheckedUtc'], ['ASC']);
}

async function setupRepoReferencesCollection() {
  await createCollection(COLLECTIONS.REPO_REFERENCES, 'Repo References');

  console.log('  Adding attributes...');
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'apiKeyId', { required: true, size: 36 });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'repoUrl', { required: true, size: 1024 });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'repoOwner', { required: false, size: 255 });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'repoName', { required: false, size: 255 });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'repoDescription', { required: false, size: 1024 });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'fileUrl', { required: true, size: 1024 });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'fileName', { required: false, size: 255 });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'filePath', { required: false, size: 512 });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'fileSha', { required: false, size: 64 });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'codeContext', { required: false, size: 2048 });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'integer', 'lineNumber', { required: false });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'searchQueryId', { required: false, size: 36 });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'datetime', 'foundUtc', { required: true });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'provider', { required: false, size: 50 });
  await createAttribute(COLLECTIONS.REPO_REFERENCES, 'string', 'branch', { required: false, size: 255 });

  console.log('  Waiting for attributes to be ready...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('  Adding indexes...');
  await createIndex(COLLECTIONS.REPO_REFERENCES, 'idx_apiKeyId', IndexType.Key, ['apiKeyId']);
}

async function setupSearchQueriesCollection() {
  await createCollection(COLLECTIONS.SEARCH_QUERIES, 'Search Queries');

  console.log('  Adding attributes...');
  await createAttribute(COLLECTIONS.SEARCH_QUERIES, 'string', 'query', { required: true, size: 512 });
  await createAttribute(COLLECTIONS.SEARCH_QUERIES, 'boolean', 'isEnabled', { required: false, default: true });
  await createAttribute(COLLECTIONS.SEARCH_QUERIES, 'integer', 'searchResultsCount', { required: false, default: 0 });
  await createAttribute(COLLECTIONS.SEARCH_QUERIES, 'datetime', 'lastSearchUtc', { required: false });

  console.log('  Waiting for attributes to be ready...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('  Adding indexes...');
  await createIndex(COLLECTIONS.SEARCH_QUERIES, 'idx_isEnabled', IndexType.Key, ['isEnabled']);
  await createIndex(COLLECTIONS.SEARCH_QUERIES, 'idx_lastSearchUtc', IndexType.Key, ['lastSearchUtc'], ['ASC']);
}

async function setupSearchProviderTokensCollection() {
  await createCollection(COLLECTIONS.SEARCH_PROVIDER_TOKENS, 'Search Provider Tokens');

  console.log('  Adding attributes...');
  await createAttribute(COLLECTIONS.SEARCH_PROVIDER_TOKENS, 'string', 'token', { required: true, size: 512 });
  await createAttribute(COLLECTIONS.SEARCH_PROVIDER_TOKENS, 'integer', 'searchProvider', { required: true });
  await createAttribute(COLLECTIONS.SEARCH_PROVIDER_TOKENS, 'boolean', 'isEnabled', { required: false, default: true });
  await createAttribute(COLLECTIONS.SEARCH_PROVIDER_TOKENS, 'datetime', 'lastUsedUtc', { required: false });

  console.log('  Waiting for attributes to be ready...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('  Adding indexes...');
  await createIndex(COLLECTIONS.SEARCH_PROVIDER_TOKENS, 'idx_searchProvider', IndexType.Key, ['searchProvider']);
  await createIndex(COLLECTIONS.SEARCH_PROVIDER_TOKENS, 'idx_isEnabled', IndexType.Key, ['isEnabled']);
}

async function setupApplicationSettingsCollection() {
  await createCollection(COLLECTIONS.APPLICATION_SETTINGS, 'Application Settings');

  console.log('  Adding attributes...');
  await createAttribute(COLLECTIONS.APPLICATION_SETTINGS, 'string', IndexType.Key, { required: true, size: 255 });
  await createAttribute(COLLECTIONS.APPLICATION_SETTINGS, 'string', 'value', { required: true, size: 2048 });
  await createAttribute(COLLECTIONS.APPLICATION_SETTINGS, 'string', 'description', { required: false, size: 512 });

  console.log('  Waiting for attributes to be ready...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('  Adding indexes...');
  await createIndex(COLLECTIONS.APPLICATION_SETTINGS, 'idx_key', IndexType.Unique, ['key']);
}

async function main() {
  console.log('='.repeat(50));
  console.log('Appwrite Database Migration');
  console.log('='.repeat(50));
  console.log(`Endpoint: ${APPWRITE_ENDPOINT}`);
  console.log(`Project: ${APPWRITE_PROJECT}`);
  console.log(`Database: ${DATABASE_ID}`);
  console.log('='.repeat(50));

  try {
    await createDatabase();

    await setupApiKeysCollection();
    await setupRepoReferencesCollection();
    await setupSearchQueriesCollection();
    await setupSearchProviderTokensCollection();
    await setupApplicationSettingsCollection();

    console.log('\n' + '='.repeat(50));
    console.log('Migration completed successfully!');
    console.log('='.repeat(50));
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  }
}

main();
