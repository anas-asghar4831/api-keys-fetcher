import { getStatistics, getKeysByStatus, hasGitHubToken } from '@/lib/actions/dashboard';
import { PageHeader } from '@/components/layout/page-header';
import { ActionButtons } from '@/components/dashboard/action-buttons';
import { StatCards } from '@/components/dashboard/stat-cards';
import { KeysTabs } from '@/components/dashboard/keys-tabs';
import { ProviderStats } from '@/components/dashboard/provider-stats';
import { TokenWarning } from '@/components/dashboard/token-warning';

export default async function Dashboard() {
  const [stats, hasToken, validKeys, invalidKeys, pendingKeys, noCreditsKeys] = await Promise.all([
    getStatistics(),
    hasGitHubToken(),
    getKeysByStatus(1, 50),
    getKeysByStatus(0, 50),
    getKeysByStatus(-99, 50),
    getKeysByStatus(7, 50),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Monitor discovered API keys and their validation status"
      >
        <ActionButtons hasToken={hasToken} />
      </PageHeader>

      <TokenWarning hasToken={hasToken} />

      <StatCards stats={stats} />

      <KeysTabs
        stats={stats}
        validKeys={validKeys}
        invalidKeys={invalidKeys}
        pendingKeys={pendingKeys}
        noCreditsKeys={noCreditsKeys}
      />

      <ProviderStats byType={stats.byType} />
    </>
  );
}
