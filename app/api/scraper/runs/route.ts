import { NextResponse } from 'next/server';
import { ScraperRunDB } from '@/lib/appwrite/database';

/**
 * GET /api/scraper/runs - Get latest scraper run
 */
export async function GET() {
  try {
    const latestRun = await ScraperRunDB.getLatest();

    if (!latestRun) {
      return NextResponse.json({ run: null });
    }

    // Parse events from JSON string
    let events = [];
    try {
      events = JSON.parse(latestRun.events || '[]');
    } catch {
      events = [];
    }

    return NextResponse.json({
      run: {
        ...latestRun,
        events,
      },
    });
  } catch (error) {
    console.error('Error fetching scraper run:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scraper run' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scraper/runs - Clear scraper history
 */
export async function DELETE() {
  try {
    const runs = await ScraperRunDB.list(100);

    for (const run of runs) {
      if (run.$id) {
        await ScraperRunDB.delete(run.$id);
      }
    }

    return NextResponse.json({ deleted: runs.length });
  } catch (error) {
    console.error('Error clearing scraper runs:', error);
    return NextResponse.json(
      { error: 'Failed to clear scraper runs' },
      { status: 500 }
    );
  }
}
