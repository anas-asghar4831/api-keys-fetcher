'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Play, RefreshCw, Download, Loader2 } from 'lucide-react';
import { runScraper, runVerifier } from '@/lib/actions/dashboard';
import { useRouter } from 'next/navigation';

interface ActionButtonsProps {
  hasToken: boolean;
}

export function ActionButtons({ hasToken }: ActionButtonsProps) {
  const [scraping, setScraping] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const router = useRouter();

  async function handleScraper() {
    if (!hasToken) {
      toast.error('Configure GitHub token in settings first');
      return;
    }

    setScraping(true);
    const result = await runScraper();
    setScraping(false);

    if (result.success) {
      toast.success(`Found ${result.newKeys} new keys`);
      router.refresh();
    } else {
      toast.error(result.error || 'Scraper failed');
    }
  }

  async function handleVerifier() {
    setVerifying(true);
    const result = await runVerifier();
    setVerifying(false);

    if (result.success) {
      toast.success(`Verified: ${result.valid} valid, ${result.invalid} invalid`);
      router.refresh();
    } else {
      toast.error(result.error || 'Verifier failed');
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={handleScraper}
        disabled={scraping || !hasToken}
        size="sm"
        className="bg-primary hover:bg-primary/90"
      >
        {scraping ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        {scraping ? 'Scraping...' : 'Run Scraper'}
      </Button>
      <Button
        onClick={handleVerifier}
        disabled={verifying}
        size="sm"
        variant="secondary"
      >
        {verifying ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        {verifying ? 'Verifying...' : 'Verify Keys'}
      </Button>
      <div className="flex-1" />
      <Button variant="ghost" size="sm" asChild>
        <a href="/api/keys?action=export&format=json" target="_blank">
          <Download className="h-4 w-4 mr-2" />
          Export
        </a>
      </Button>
    </div>
  );
}
