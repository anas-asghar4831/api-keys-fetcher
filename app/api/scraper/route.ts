import { NextRequest, NextResponse } from 'next/server';
import { createScraperService } from '@/lib/services/scraper';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Verify authorization for external calls
    const authHeader = request.headers.get('authorization');
    const isAuthorized =
      !CRON_SECRET || // Allow if no secret configured (dev mode)
      authHeader === `Bearer ${CRON_SECRET}`;

    if (!isAuthorized) {
      return NextResponse.json(
        { status: 'error', error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const scraper = createScraperService();
    const result = await scraper.runScrapingCycle();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: 'error', error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const scraper = createScraperService();
    const status = await scraper.isReady();
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ready: false, reason: message },
      { status: 500 }
    );
  }
}
