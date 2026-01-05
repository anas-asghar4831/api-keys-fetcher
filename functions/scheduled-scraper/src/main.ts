import { Client, Databases } from 'node-appwrite';

interface Context {
  req: {
    body: string;
    headers: Record<string, string>;
    method: string;
  };
  res: {
    json: (data: Record<string, unknown>, status?: number) => void;
    text: (text: string, status?: number) => void;
  };
  log: (message: string) => void;
  error: (message: string) => void;
}

async function handler({ res, log, error }: Context) {
  // Environment variables (set in Appwrite Console)
  const APP_URL = process.env.APP_URL; // Your Next.js app URL
  const CRON_SECRET = process.env.CRON_SECRET;
  const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
  const APPWRITE_PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
  const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'unsecured-api-keys';

  if (!APP_URL || !CRON_SECRET) {
    error('Missing required environment variables: APP_URL or CRON_SECRET');
    return res.json({ success: false, error: 'Configuration error' }, 500);
  }

  log(`Starting scheduled scrape at ${new Date().toISOString()}`);

  try {
    // Call the scraper API endpoint
    const response = await fetch(`${APP_URL}/api/scraper`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      error(`Scraper API error: ${response.status} - ${JSON.stringify(result)}`);
      return res.json({ success: false, error: result.error || 'API error' }, response.status);
    }

    log(`Scrape complete: ${JSON.stringify(result)}`);

    // Optionally log the run to database
    if (APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID && APPWRITE_API_KEY) {
      try {
        const client = new Client()
          .setEndpoint(APPWRITE_ENDPOINT)
          .setProject(APPWRITE_PROJECT_ID)
          .setKey(APPWRITE_API_KEY);

        const databases = new Databases(client);

        await databases.createDocument(DATABASE_ID, 'scraper_runs', 'unique()', {
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          status: result.status || 'complete',
          totalResults: result.totalResults || 0,
          newKeys: result.newKeys || 0,
          duplicates: result.duplicates || 0,
          errors: result.errors || 0,
          events: JSON.stringify([{ type: 'cron', message: 'Scheduled execution' }]),
        });

        log('Run logged to database');
      } catch (dbErr) {
        error(`Failed to log run: ${dbErr}`);
      }
    }

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    error(`Scrape failed: ${message}`);
    return res.json({ success: false, error: message }, 500);
  }
}

export default handler;
