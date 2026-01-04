import { AlertCircle } from 'lucide-react';

export function TokenWarning({ hasToken }: { hasToken: boolean }) {
  if (hasToken) return null;

  return (
    <div className="mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <p className="text-sm text-amber-400">
        <AlertCircle className="h-4 w-4 inline mr-2" />
        GitHub token not configured. Go to Settings to enable scraping.
      </p>
    </div>
  );
}
