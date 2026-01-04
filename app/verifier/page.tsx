import { PageHeader } from '@/components/layout/page-header';
import { VerifierConsole } from '@/components/verifier/verifier-console';

export default function VerifierPage() {
  return (
    <>
      <PageHeader
        title="Verifier"
        description="Verify discovered API keys in parallel with real-time logging"
      />

      <VerifierConsole />
    </>
  );
}
