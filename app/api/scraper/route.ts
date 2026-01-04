import { NextResponse } from 'next/server';
import { createScraperService } from '@/lib/services/scraper';

export async function POST() {
  try {
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
