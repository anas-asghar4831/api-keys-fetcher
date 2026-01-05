'use server';

import { createServerClient, DATABASE_ID, COLLECTION_IDS } from '@/lib/appwrite/client';
import { SearchProviderTokenDB, ApplicationSettingDB } from '@/lib/appwrite/database';
import { DEFAULT_SEARCH_QUERIES } from '@/lib/utils/constants';
import { Query, ID } from 'node-appwrite';
import { revalidatePath } from 'next/cache';

// Application settings keys
const GITHUB_COOKIES_KEY = 'github_session_cookies';
const GITHUB_COOKIES_UPDATED_KEY = 'github_cookies_updated_at';

export interface SearchQuery {
  id: string;
  query: string;
  isEnabled: boolean;
  lastSearchUtc: string | null;
  searchResultsCount: number;
}

export interface GitHubCookiesStatus {
  hasCookies: boolean;
  updatedAt: string | null;
  isValid: boolean | null; // null = not tested
}

export interface SettingsData {
  hasGitHubToken: boolean;
  searchQueriesCount: number;
  searchQueries: SearchQuery[];
  githubCookies: GitHubCookiesStatus;
}

export async function getSettings(): Promise<SettingsData> {
  try {
    const { databases } = createServerClient();

    // Check for GitHub token
    const hasToken = await SearchProviderTokenDB.hasGitHubToken();

    // Check for GitHub cookies
    const cookiesValue = await ApplicationSettingDB.get(GITHUB_COOKIES_KEY);
    const cookiesUpdatedAt = await ApplicationSettingDB.get(GITHUB_COOKIES_UPDATED_KEY);

    // Get search queries
    const queriesRes = await databases.listDocuments(DATABASE_ID, COLLECTION_IDS.SEARCH_QUERIES, [
      Query.orderAsc('query'),
      Query.limit(100),
    ]);

    return {
      hasGitHubToken: hasToken,
      searchQueriesCount: queriesRes.total,
      searchQueries: queriesRes.documents.map((doc: { $id: string; query: string; isEnabled: boolean; lastSearchUtc?: string; searchResultsCount?: number }) => ({
        id: doc.$id,
        query: doc.query,
        isEnabled: doc.isEnabled,
        lastSearchUtc: doc.lastSearchUtc || null,
        searchResultsCount: doc.searchResultsCount || 0,
      })),
      githubCookies: {
        hasCookies: !!cookiesValue,
        updatedAt: cookiesUpdatedAt,
        isValid: null, // Will be tested separately
      },
    };
  } catch (error) {
    console.error('Error fetching settings:', error);
    return {
      hasGitHubToken: false,
      searchQueriesCount: 0,
      searchQueries: [],
      githubCookies: {
        hasCookies: false,
        updatedAt: null,
        isValid: null,
      },
    };
  }
}

export async function saveGitHubToken(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    await SearchProviderTokenDB.saveGitHubToken(token);
    revalidatePath('/settings');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error saving token:', error);
    return { success: false, error: 'Failed to save token' };
  }
}

export async function toggleSearchQuery(queryId: string, isEnabled: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const { databases } = createServerClient();

    await databases.updateDocument(DATABASE_ID, COLLECTION_IDS.SEARCH_QUERIES, queryId, {
      isEnabled,
    });

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('Error toggling query:', error);
    return { success: false, error: 'Failed to update query' };
  }
}

export async function initializeDatabase(): Promise<{ success: boolean; error?: string }> {
  try {
    const { databases } = createServerClient();

    // Delete existing queries
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTION_IDS.SEARCH_QUERIES, [
      Query.limit(500),
    ]);

    for (const doc of existing.documents) {
      await databases.deleteDocument(DATABASE_ID, COLLECTION_IDS.SEARCH_QUERIES, doc.$id);
    }

    // Create default queries
    for (const query of DEFAULT_SEARCH_QUERIES) {
      await databases.createDocument(DATABASE_ID, COLLECTION_IDS.SEARCH_QUERIES, ID.unique(), {
        query,
        isEnabled: true,
        searchResultsCount: 0,
      });
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('Error initializing database:', error);
    return { success: false, error: 'Failed to initialize database' };
  }
}

/**
 * Save GitHub session cookies for web search
 */
export async function saveGitHubCookies(cookies: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate cookies format - should contain user_session
    if (!cookies.includes('user_session')) {
      return { success: false, error: 'Invalid cookies: must contain user_session' };
    }

    await ApplicationSettingDB.set(
      GITHUB_COOKIES_KEY,
      cookies,
      'GitHub session cookies for web search'
    );
    await ApplicationSettingDB.set(
      GITHUB_COOKIES_UPDATED_KEY,
      new Date().toISOString(),
      'Last update time for GitHub cookies'
    );

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('Error saving GitHub cookies:', error);
    return { success: false, error: 'Failed to save cookies' };
  }
}

/**
 * Get GitHub session cookies
 */
export async function getGitHubCookies(): Promise<string | null> {
  return ApplicationSettingDB.get(GITHUB_COOKIES_KEY);
}

/**
 * Test GitHub cookies by making a search request
 */
export async function testGitHubCookies(): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const cookies = await ApplicationSettingDB.get(GITHUB_COOKIES_KEY);

    if (!cookies) {
      return { success: false, error: 'No cookies configured' };
    }

    // Make a test search request to GitHub
    const response = await fetch('https://github.com/search?q=test&type=code', {
      headers: {
        'accept': 'application/json',
        'x-requested-with': 'XMLHttpRequest',
        'cookie': cookies,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (response.ok) {
      const data = await response.json();
      // Check if we got search results
      if (data.payload?.results || data.results) {
        return { success: true, message: 'Cookies are valid and working!' };
      }
      return { success: false, error: 'Unexpected response format' };
    }

    if (response.status === 401 || response.status === 403) {
      return { success: false, error: 'Cookies expired or invalid - please update them' };
    }

    return { success: false, error: `GitHub returned status ${response.status}` };
  } catch (error) {
    console.error('Error testing GitHub cookies:', error);
    return { success: false, error: 'Failed to test cookies: ' + (error instanceof Error ? error.message : String(error)) };
  }
}

/**
 * Clear GitHub session cookies
 */
export async function clearGitHubCookies(): Promise<{ success: boolean; error?: string }> {
  try {
    await ApplicationSettingDB.delete(GITHUB_COOKIES_KEY);
    await ApplicationSettingDB.delete(GITHUB_COOKIES_UPDATED_KEY);

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('Error clearing GitHub cookies:', error);
    return { success: false, error: 'Failed to clear cookies' };
  }
}
