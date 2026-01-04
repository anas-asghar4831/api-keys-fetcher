'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Github, Check, X, Loader2, ExternalLink } from 'lucide-react';
import { saveGitHubToken } from '@/lib/actions/settings';
import { useRouter } from 'next/navigation';

interface TokenFormProps {
  hasToken: boolean;
}

export function TokenForm({ hasToken }: TokenFormProps) {
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSaveToken() {
    if (!token.trim()) {
      toast.error('Please enter a GitHub token');
      return;
    }

    setSaving(true);
    const result = await saveGitHubToken(token.trim());
    setSaving(false);

    if (result.success) {
      toast.success('Token saved successfully');
      setToken('');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to save token');
    }
  }

  return (
    <Card className="mb-6 border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Github className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-medium">GitHub Token</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Personal access token for searching repositories
            </CardDescription>
          </div>
          <div className="ml-auto">
            <Badge
              className={
                hasToken
                  ? 'bg-emerald-500/20 text-emerald-400 border-0'
                  : 'bg-red-500/20 text-red-400 border-0'
              }
            >
              {hasToken ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Configured
                </>
              ) : (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Not Set
                </>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-3">
          <Input
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="bg-muted border-border"
          />
          <Button onClick={handleSaveToken} disabled={saving} size="default">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Create a token with <code className="text-primary">public_repo</code> scope at{' '}
          <a
            href="https://github.com/settings/tokens/new"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            GitHub Settings
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
