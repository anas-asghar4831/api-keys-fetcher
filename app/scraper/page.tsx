import { hasGitHubToken } from '@/lib/actions/dashboard';
import { PageHeader } from '@/components/layout/page-header';
import { ScraperConsole } from '@/components/dashboard/scraper-console';

export default async function ScraperPage() {
  const hasToken = await hasGitHubToken();

  return (
    <>
      <PageHeader
        title="Scraper"
        description="Run and monitor the API key scraper in real-time"
      />

      <ScraperConsole hasToken={hasToken} />
    </>
  );
}
