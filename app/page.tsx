import { hasGitHubToken } from '@/lib/actions/dashboard';
import { PageHeader } from '@/components/layout/page-header';
import { ActionButtons } from '@/components/dashboard/action-buttons';
import { TokenWarning } from '@/components/dashboard/token-warning';
import { KeysView } from '@/components/keys/keys-view';

export default async function Dashboard() {
  const hasToken = await hasGitHubToken();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Monitor discovered API keys and their validation status"
      >
        <ActionButtons hasToken={hasToken} />
      </PageHeader>

      <TokenWarning hasToken={hasToken} />

      <KeysView />
    </>
  );
}
