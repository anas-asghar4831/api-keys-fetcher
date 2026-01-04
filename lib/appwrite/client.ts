import { Client, Databases, Account, ID, Query } from 'appwrite';

// Environment variables
const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT || '';

/**
 * Appwrite client for browser-side operations
 */
export const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT);

/**
 * Appwrite Databases service
 */
export const databases = new Databases(client);

/**
 * Appwrite Account service
 */
export const account = new Account(client);

/**
 * Re-export utilities
 */
export { ID, Query };

/**
 * Database configuration
 */
export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'unsecured-api-keys';

/**
 * Collection IDs
 */
export const COLLECTION_IDS = {
  API_KEYS: 'api_keys',
  REPO_REFERENCES: 'repo_references',
  SEARCH_QUERIES: 'search_queries',
  SEARCH_PROVIDER_TOKENS: 'search_provider_tokens',
  APPLICATION_SETTINGS: 'application_settings',
  SCRAPER_RUNS: 'scraper_runs',
} as const;

/**
 * Create server-side Appwrite client
 * Use this in API routes and server components
 */
export function createServerClient() {
  // Import node-appwrite for server-side
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client, Databases } = require('node-appwrite');

  const serverClient = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT || APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT || APPWRITE_PROJECT)
    .setKey(process.env.APPWRITE_API_KEY || '');

  return {
    client: serverClient,
    databases: new Databases(serverClient),
  };
}

/**
 * Helper to check if Appwrite is configured
 */
export function isAppwriteConfigured(): boolean {
  return !!(APPWRITE_PROJECT && APPWRITE_ENDPOINT);
}

/**
 * Get configuration status
 */
export function getAppwriteConfig() {
  return {
    endpoint: APPWRITE_ENDPOINT,
    project: APPWRITE_PROJECT,
    databaseId: DATABASE_ID,
    isConfigured: isAppwriteConfigured(),
  };
}
