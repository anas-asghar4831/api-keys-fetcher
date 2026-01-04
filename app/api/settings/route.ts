import { NextRequest, NextResponse } from 'next/server';
import {
  SearchProviderTokenDB,
  SearchQueryDB,
  initializeDatabase,
} from '@/lib/appwrite/database';

export async function GET() {
  try {
    const hasToken = await SearchProviderTokenDB.hasGitHubToken();
    const queries = await SearchQueryDB.listEnabled();

    return NextResponse.json({
      hasGitHubToken: hasToken,
      searchQueriesCount: queries.length,
      searchQueries: queries.map((q) => ({
        id: q.$id,
        query: q.query,
        isEnabled: q.isEnabled,
        lastSearchUtc: q.lastSearchUtc,
        searchResultsCount: q.searchResultsCount,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, token, queryId, isEnabled } = body;

    // Save GitHub token
    if (action === 'saveToken' && token) {
      await SearchProviderTokenDB.saveGitHubToken(token);
      return NextResponse.json({ success: true });
    }

    // Toggle search query
    if (action === 'toggleQuery' && queryId !== undefined) {
      await SearchQueryDB.update(queryId, { isEnabled });
      return NextResponse.json({ success: true });
    }

    // Initialize database with defaults
    if (action === 'initialize') {
      await initializeDatabase();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
