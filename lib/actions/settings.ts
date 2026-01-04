'use server';

import { createServerClient, DATABASE_ID, COLLECTION_IDS } from '@/lib/appwrite/client';
import { SearchProviderTokenDB } from '@/lib/appwrite/database';
import { DEFAULT_SEARCH_QUERIES } from '@/lib/utils/constants';
import { Query, ID } from 'node-appwrite';
import { revalidatePath } from 'next/cache';

export interface SearchQuery {
  id: string;
  query: string;
  isEnabled: boolean;
  lastSearchUtc: string | null;
  searchResultsCount: number;
}

export interface SettingsData {
  hasGitHubToken: boolean;
  searchQueriesCount: number;
  searchQueries: SearchQuery[];
}

export async function getSettings(): Promise<SettingsData> {
  try {
    const { databases } = createServerClient();

    // Check for GitHub token
    const hasToken = await SearchProviderTokenDB.hasGitHubToken();

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
    };
  } catch (error) {
    console.error('Error fetching settings:', error);
    return {
      hasGitHubToken: false,
      searchQueriesCount: 0,
      searchQueries: [],
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
