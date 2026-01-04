'use server';

import { ApiKeyDB, SearchProviderTokenDB } from '@/lib/appwrite/database';
import { ApiStatusEnum } from '@/lib/providers/types';

export interface Statistics {
  total: number;
  valid: number;
  invalid: number;
  unverified: number;
  validNoCredits: number;
  error: number;
  byType: Record<string, number>;
}

export interface ApiKeyData {
  $id: string;
  apiKey: string;
  status: number;
  apiType: number;
  firstFoundUtc: string;
  lastCheckedUtc: string | null;
}

export async function getStatistics(): Promise<Statistics> {
  try {
    return await ApiKeyDB.getStatistics();
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return {
      total: 0,
      valid: 0,
      invalid: 0,
      unverified: 0,
      validNoCredits: 0,
      error: 0,
      byType: {},
    };
  }
}

export async function getKeysByStatus(status: number, limit = 50): Promise<ApiKeyData[]> {
  try {
    const keys = await ApiKeyDB.listByStatus(status as ApiStatusEnum, limit);
    return keys.map((doc) => ({
      $id: doc.$id!,
      apiKey: doc.apiKey,
      status: doc.status,
      apiType: doc.apiType,
      firstFoundUtc: doc.firstFoundUtc,
      lastCheckedUtc: doc.lastCheckedUtc || null,
    }));
  } catch (error) {
    console.error('Error fetching keys:', error);
    return [];
  }
}

export async function hasGitHubToken(): Promise<boolean> {
  try {
    return await SearchProviderTokenDB.hasGitHubToken();
  } catch {
    return false;
  }
}

export async function runScraper(): Promise<{ success: boolean; newKeys?: number; error?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/scraper`, {
      method: 'POST',
      cache: 'no-store',
    });
    const data = await res.json();

    if (data.status === 'success') {
      return { success: true, newKeys: data.newKeys };
    }
    return { success: false, error: data.error || 'Scraper failed' };
  } catch {
    return { success: false, error: 'Failed to run scraper' };
  }
}

export async function runVerifier(): Promise<{ success: boolean; valid?: number; invalid?: number; error?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/verifier`, {
      method: 'POST',
      cache: 'no-store',
    });
    const data = await res.json();

    if (data.status === 'success') {
      return { success: true, valid: data.valid, invalid: data.invalid };
    }
    return { success: false, error: data.error || 'Verifier failed' };
  } catch {
    return { success: false, error: 'Failed to run verifier' };
  }
}
