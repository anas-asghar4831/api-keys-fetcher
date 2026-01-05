import { Query, ID } from 'appwrite';
import { createServerClient, DATABASE_ID, COLLECTION_IDS } from './client';
import {
  ApiKey,
  RepoReference,
  SearchQuery,
  SearchProviderToken,
  ApplicationSetting,
  ScraperRun,
  ApiStatusEnum,
  ApiTypeEnum,
  SearchProviderEnum,
} from '../providers/types';
import { DEFAULT_SEARCH_QUERIES } from '../utils/constants';

/**
 * Database operations for API Keys collection
 */
export const ApiKeyDB = {
  async create(data: Omit<ApiKey, '$id'>): Promise<ApiKey> {
    const { databases } = createServerClient();
    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_IDS.API_KEYS,
      ID.unique(),
      data
    );
    return doc as unknown as ApiKey;
  },

  async get(id: string): Promise<ApiKey | null> {
    try {
      const { databases } = createServerClient();
      const doc = await databases.getDocument(
        DATABASE_ID,
        COLLECTION_IDS.API_KEYS,
        id
      );
      return doc as unknown as ApiKey;
    } catch {
      return null;
    }
  },

  async getByApiKey(apiKey: string): Promise<ApiKey | null> {
    try {
      const { databases } = createServerClient();
      const result = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_IDS.API_KEYS,
        [Query.equal('apiKey', apiKey), Query.limit(1)]
      );
      return result.documents.length > 0
        ? (result.documents[0] as unknown as ApiKey)
        : null;
    } catch {
      return null;
    }
  },

  async exists(apiKey: string): Promise<boolean> {
    const existing = await this.getByApiKey(apiKey);
    return existing !== null;
  },

  async update(id: string, data: Partial<ApiKey>): Promise<ApiKey> {
    const { databases } = createServerClient();
    const doc = await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_IDS.API_KEYS,
      id,
      data
    );
    return doc as unknown as ApiKey;
  },

  async delete(id: string): Promise<void> {
    const { databases } = createServerClient();
    await databases.deleteDocument(DATABASE_ID, COLLECTION_IDS.API_KEYS, id);
  },

  async listByStatus(
    status: ApiStatusEnum,
    limit: number = 100,
    offset: number = 0
  ): Promise<ApiKey[]> {
    const { databases } = createServerClient();
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.API_KEYS,
      [
        Query.equal('status', status),
        Query.limit(limit),
        Query.offset(offset),
        Query.orderAsc('firstFoundUtc'),
      ]
    );
    return result.documents as unknown as ApiKey[];
  },

  async listUnverified(limit: number = 10): Promise<ApiKey[]> {
    return this.listByStatus(ApiStatusEnum.Unverified, limit);
  },

  async listValid(limit: number = 50): Promise<ApiKey[]> {
    const { databases } = createServerClient();
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.API_KEYS,
      [
        Query.equal('status', ApiStatusEnum.Valid),
        Query.limit(limit),
        Query.orderAsc('lastCheckedUtc'),
      ]
    );
    return result.documents as unknown as ApiKey[];
  },

  async countByStatus(status: ApiStatusEnum): Promise<number> {
    const { databases } = createServerClient();
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.API_KEYS,
      [Query.equal('status', status), Query.limit(1)]
    );
    return result.total;
  },

  async countAll(): Promise<number> {
    const { databases } = createServerClient();
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.API_KEYS,
      [Query.limit(1)]
    );
    return result.total;
  },

  async getStatistics(): Promise<{
    total: number;
    valid: number;
    invalid: number;
    unverified: number;
    validNoCredits: number;
    error: number;
    byType: Record<string, number>;
  }> {
    const { databases } = createServerClient();

    // Get counts for each status
    const [total, valid, invalid, unverified, validNoCredits, error] =
      await Promise.all([
        this.countAll(),
        this.countByStatus(ApiStatusEnum.Valid),
        this.countByStatus(ApiStatusEnum.Invalid),
        this.countByStatus(ApiStatusEnum.Unverified),
        this.countByStatus(ApiStatusEnum.ValidNoCredits),
        this.countByStatus(ApiStatusEnum.Error),
      ]);

    // Get counts by type for valid keys
    const byType: Record<string, number> = {};
    const validKeys = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.API_KEYS,
      [Query.equal('status', ApiStatusEnum.Valid), Query.limit(1000)]
    );

    for (const key of validKeys.documents) {
      const typeName = ApiTypeEnum[key.apiType as ApiTypeEnum] || 'Unknown';
      byType[typeName] = (byType[typeName] || 0) + 1;
    }

    return {
      total,
      valid,
      invalid,
      unverified,
      validNoCredits,
      error,
      byType,
    };
  },
};

/**
 * Database operations for Repo References collection
 */
export const RepoReferenceDB = {
  async create(data: Omit<RepoReference, '$id'>): Promise<RepoReference> {
    const { databases } = createServerClient();
    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_IDS.REPO_REFERENCES,
      ID.unique(),
      data
    );
    return doc as unknown as RepoReference;
  },

  async listByApiKeyId(apiKeyId: string): Promise<RepoReference[]> {
    const { databases } = createServerClient();
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.REPO_REFERENCES,
      [Query.equal('apiKeyId', apiKeyId), Query.limit(100)]
    );
    return result.documents as unknown as RepoReference[];
  },

  async delete(id: string): Promise<void> {
    const { databases } = createServerClient();
    await databases.deleteDocument(
      DATABASE_ID,
      COLLECTION_IDS.REPO_REFERENCES,
      id
    );
  },

  async deleteByApiKeyId(apiKeyId: string): Promise<void> {
    const references = await this.listByApiKeyId(apiKeyId);
    await Promise.all(references.map((ref) => this.delete(ref.$id!)));
  },
};

/**
 * Database operations for Search Queries collection
 */
export const SearchQueryDB = {
  async create(data: Omit<SearchQuery, '$id'>): Promise<SearchQuery> {
    const { databases } = createServerClient();
    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_IDS.SEARCH_QUERIES,
      ID.unique(),
      data
    );
    return doc as unknown as SearchQuery;
  },

  async update(id: string, data: Partial<SearchQuery>): Promise<SearchQuery> {
    const { databases } = createServerClient();
    const doc = await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_IDS.SEARCH_QUERIES,
      id,
      data
    );
    return doc as unknown as SearchQuery;
  },

  async listEnabled(): Promise<SearchQuery[]> {
    const { databases } = createServerClient();
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.SEARCH_QUERIES,
      [Query.equal('isEnabled', true), Query.limit(100)]
    );
    return result.documents as unknown as SearchQuery[];
  },

  async getNextDue(): Promise<SearchQuery | null> {
    const { databases } = createServerClient();

    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.SEARCH_QUERIES,
      [
        Query.equal('isEnabled', true),
        Query.orderAsc('lastSearchUtc'),
        Query.limit(1),
      ]
    );

    return result.documents.length > 0
      ? (result.documents[0] as unknown as SearchQuery)
      : null;
  },

  async seedDefaults(): Promise<void> {
    const { databases } = createServerClient();

    // Check if queries already exist
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.SEARCH_QUERIES,
      [Query.limit(1)]
    );

    if (existing.total > 0) {
      return; // Already seeded
    }

    // Create default queries
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    await Promise.all(
      DEFAULT_SEARCH_QUERIES.map((query) =>
        this.create({
          query,
          isEnabled: true,
          searchResultsCount: 0,
          lastSearchUtc: yesterday,
        })
      )
    );
  },
};

/**
 * Database operations for Search Provider Tokens collection
 */
export const SearchProviderTokenDB = {
  async create(
    data: Omit<SearchProviderToken, '$id'>
  ): Promise<SearchProviderToken> {
    const { databases } = createServerClient();
    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_IDS.SEARCH_PROVIDER_TOKENS,
      ID.unique(),
      data
    );
    return doc as unknown as SearchProviderToken;
  },

  async update(
    id: string,
    data: Partial<SearchProviderToken>
  ): Promise<SearchProviderToken> {
    const { databases } = createServerClient();
    const doc = await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_IDS.SEARCH_PROVIDER_TOKENS,
      id,
      data
    );
    return doc as unknown as SearchProviderToken;
  },

  async getGitHubToken(): Promise<SearchProviderToken | null> {
    const { databases } = createServerClient();
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.SEARCH_PROVIDER_TOKENS,
      [
        Query.equal('searchProvider', SearchProviderEnum.GitHub),
        Query.equal('isEnabled', true),
        Query.limit(1),
      ]
    );
    return result.documents.length > 0
      ? (result.documents[0] as unknown as SearchProviderToken)
      : null;
  },

  async getAllGitHubTokens(): Promise<SearchProviderToken[]> {
    const { databases } = createServerClient();
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.SEARCH_PROVIDER_TOKENS,
      [
        Query.equal('searchProvider', SearchProviderEnum.GitHub),
        Query.equal('isEnabled', true),
        Query.limit(100),
      ]
    );
    return result.documents as unknown as SearchProviderToken[];
  },

  async saveGitHubToken(token: string): Promise<SearchProviderToken> {
    const existing = await this.getGitHubToken();

    if (existing) {
      return this.update(existing.$id!, {
        token,
        isEnabled: true,
      });
    }

    return this.create({
      token,
      searchProvider: SearchProviderEnum.GitHub,
      isEnabled: true,
    });
  },

  async hasGitHubToken(): Promise<boolean> {
    const token = await this.getGitHubToken();
    return token !== null && !!token.token;
  },
};

/**
 * Database operations for Application Settings collection
 */
export const ApplicationSettingDB = {
  async get(key: string): Promise<string | null> {
    const { databases } = createServerClient();
    try {
      const result = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_IDS.APPLICATION_SETTINGS,
        [Query.equal('key', key), Query.limit(1)]
      );
      return result.documents.length > 0
        ? (result.documents[0] as unknown as ApplicationSetting).value
        : null;
    } catch {
      return null;
    }
  },

  async set(
    key: string,
    value: string,
    description?: string
  ): Promise<ApplicationSetting> {
    const { databases } = createServerClient();

    // Check if setting exists
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.APPLICATION_SETTINGS,
      [Query.equal('key', key), Query.limit(1)]
    );

    if (existing.documents.length > 0) {
      const doc = await databases.updateDocument(
        DATABASE_ID,
        COLLECTION_IDS.APPLICATION_SETTINGS,
        existing.documents[0].$id,
        { value, description }
      );
      return doc as unknown as ApplicationSetting;
    }

    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_IDS.APPLICATION_SETTINGS,
      ID.unique(),
      { key, value, description }
    );
    return doc as unknown as ApplicationSetting;
  },

  async delete(key: string): Promise<void> {
    const { databases } = createServerClient();
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.APPLICATION_SETTINGS,
      [Query.equal('key', key), Query.limit(1)]
    );

    if (result.documents.length > 0) {
      await databases.deleteDocument(
        DATABASE_ID,
        COLLECTION_IDS.APPLICATION_SETTINGS,
        result.documents[0].$id
      );
    }
  },
};

/**
 * Database operations for Scraper Runs collection
 */
export const ScraperRunDB = {
  async create(data: Omit<ScraperRun, '$id'>): Promise<ScraperRun> {
    const { databases } = createServerClient();
    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTION_IDS.SCRAPER_RUNS,
      ID.unique(),
      data
    );
    return doc as unknown as ScraperRun;
  },

  async update(id: string, data: Partial<ScraperRun>): Promise<ScraperRun> {
    const { databases } = createServerClient();
    const doc = await databases.updateDocument(
      DATABASE_ID,
      COLLECTION_IDS.SCRAPER_RUNS,
      id,
      data
    );
    return doc as unknown as ScraperRun;
  },

  async getLatest(): Promise<ScraperRun | null> {
    try {
      const { databases } = createServerClient();
      const result = await databases.listDocuments(
        DATABASE_ID,
        COLLECTION_IDS.SCRAPER_RUNS,
        [Query.orderDesc('startedAt'), Query.limit(1)]
      );
      return result.documents.length > 0
        ? (result.documents[0] as unknown as ScraperRun)
        : null;
    } catch {
      return null;
    }
  },

  async list(limit: number = 10): Promise<ScraperRun[]> {
    const { databases } = createServerClient();
    const result = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.SCRAPER_RUNS,
      [Query.orderDesc('startedAt'), Query.limit(limit)]
    );
    return result.documents as unknown as ScraperRun[];
  },

  async delete(id: string): Promise<void> {
    const { databases } = createServerClient();
    await databases.deleteDocument(DATABASE_ID, COLLECTION_IDS.SCRAPER_RUNS, id);
  },

  async deleteOld(keepCount: number = 10): Promise<number> {
    const { databases } = createServerClient();
    const all = await databases.listDocuments(
      DATABASE_ID,
      COLLECTION_IDS.SCRAPER_RUNS,
      [Query.orderDesc('startedAt'), Query.limit(100)]
    );

    let deleted = 0;
    for (let i = keepCount; i < all.documents.length; i++) {
      await this.delete(all.documents[i].$id);
      deleted++;
    }
    return deleted;
  },
};

/**
 * Initialize database with default data
 */
export async function initializeDatabase(): Promise<void> {
  await SearchQueryDB.seedDefaults();
}

/**
 * Export data to JSON format
 */
export async function exportKeysToJSON(
  statusFilter?: ApiStatusEnum
): Promise<string> {
  const { databases } = createServerClient();

  const queries = statusFilter
    ? [Query.equal('status', statusFilter), Query.limit(1000)]
    : [Query.limit(1000)];

  const keys = await databases.listDocuments(
    DATABASE_ID,
    COLLECTION_IDS.API_KEYS,
    queries
  );

  interface KeyDocument {
    $id: string;
    apiKey: string;
    apiType: number;
    status: number;
    firstFoundUtc: string;
    lastCheckedUtc: string | null;
  }

  const exportData = await Promise.all(
    (keys.documents as unknown as KeyDocument[]).map(async (key) => {
      const refs = await RepoReferenceDB.listByApiKeyId(key.$id);
      return {
        id: key.$id,
        apiKey: key.apiKey,
        type: ApiTypeEnum[key.apiType as ApiTypeEnum],
        status: ApiStatusEnum[key.status as ApiStatusEnum],
        firstFoundUtc: key.firstFoundUtc,
        lastCheckedUtc: key.lastCheckedUtc,
        sources: refs.map((ref) => ({
          repoUrl: ref.repoUrl,
          repoOwner: ref.repoOwner,
          repoName: ref.repoName,
          filePath: ref.filePath,
          foundUtc: ref.foundUtc,
        })),
      };
    })
  );

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export data to CSV format
 */
export async function exportKeysToCSV(
  statusFilter?: ApiStatusEnum
): Promise<string> {
  const { databases } = createServerClient();

  const queries = statusFilter
    ? [Query.equal('status', statusFilter), Query.limit(1000)]
    : [Query.limit(1000)];

  const keys = await databases.listDocuments(
    DATABASE_ID,
    COLLECTION_IDS.API_KEYS,
    queries
  );

  interface KeyDocument {
    $id: string;
    apiKey: string;
    apiType: number;
    status: number;
    firstFoundUtc: string;
    lastCheckedUtc: string | null;
  }

  const header = 'Id,ApiKey,Type,Status,FirstFoundUtc,LastCheckedUtc,RepoURL\n';

  const rows = await Promise.all(
    (keys.documents as unknown as KeyDocument[]).map(async (key) => {
      const refs = await RepoReferenceDB.listByApiKeyId(key.$id);
      const repoUrl = refs.length > 0 ? refs[0].repoUrl : '';
      return `${key.$id},"${key.apiKey}",${ApiTypeEnum[key.apiType as ApiTypeEnum]},${ApiStatusEnum[key.status as ApiStatusEnum]},${key.firstFoundUtc},${key.lastCheckedUtc || ''},"${repoUrl}"`;
    })
  );

  return header + rows.join('\n');
}
