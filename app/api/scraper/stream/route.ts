import { createStreamingScraper } from '@/lib/services/scraper-stream';
import { ScraperEvent, ScraperProgress } from '@/lib/utils/scraper-events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: ScraperEvent, progress: ScraperProgress) => {
        const data = JSON.stringify({ event, progress });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      try {
        const scraper = createStreamingScraper(sendEvent);
        await scraper.run();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const errorEvent = {
          type: 'error' as const,
          timestamp: new Date().toISOString(),
          message: `Fatal error: ${message}`,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: errorEvent })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
