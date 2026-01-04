import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyDB } from '@/lib/appwrite/database';
import { ProviderRegistry } from '@/lib/providers/registry';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
    }

    // Get the key from database
    const key = await ApiKeyDB.get(keyId);
    if (!key) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    // Get the provider for this key type
    const provider = ProviderRegistry.getProviderByType(key.apiType);
    if (!provider) {
      return NextResponse.json({
        status: 'error',
        isValid: false,
        hasCredits: false,
        models: [],
        error: 'No provider found for this key type',
      });
    }

    // Get key details
    if (provider.getKeyDetails) {
      const details = await provider.getKeyDetails(key.apiKey);
      return NextResponse.json({
        ...details,
        provider: provider.providerName,
        apiType: key.apiType,
        lastChecked: key.lastCheckedUtc,
      });
    }

    // Fallback - just validate
    const validation = await provider.validateKey(key.apiKey);
    return NextResponse.json({
      status: validation.status === 'valid' ? 'success' : 'error',
      isValid: validation.status === 'valid',
      hasCredits: validation.hasCredits !== false,
      models: validation.availableModels || [],
      provider: provider.providerName,
      apiType: key.apiType,
      lastChecked: key.lastCheckedUtc,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: 'error', error: message },
      { status: 500 }
    );
  }
}
