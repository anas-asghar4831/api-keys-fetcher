import { getSettings } from '@/lib/actions/settings';
import { PageHeader } from '@/components/layout/page-header';
import { TokenForm } from '@/components/settings/token-form';
import { CookieForm } from '@/components/settings/cookie-form';
import { QueryTable } from '@/components/settings/query-table';
import { DatabaseInfo } from '@/components/settings/database-info';

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure API key discovery settings"
      />

      <TokenForm hasToken={settings.hasGitHubToken} />

      <CookieForm cookieStatus={settings.githubCookies} />

      <QueryTable searchQueries={settings.searchQueries} />

      <DatabaseInfo />
    </>
  );
}
