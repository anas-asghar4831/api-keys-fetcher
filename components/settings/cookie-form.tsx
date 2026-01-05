'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Cookie, Check, X, Loader2, TestTube, Trash2, Clock, AlertTriangle, ChevronDown } from 'lucide-react';
import { saveGitHubCookies, testGitHubCookies, clearGitHubCookies, GitHubCookiesStatus } from '@/lib/actions/settings';
import { useRouter } from 'next/navigation';

interface CookieFormProps {
  cookieStatus: GitHubCookiesStatus;
}

interface CookieFields {
  userSession: string;
  hostUserSession: string;
  loggedIn: string;
  ghSess: string;
}

function calculateDaysSinceUpdate(updatedAt: string | null): { daysSinceUpdate: number | null; isStale: boolean } {
  if (!updatedAt) {
    return { daysSinceUpdate: null, isStale: false };
  }
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  return { daysSinceUpdate: days, isStale: days > 7 };
}

function buildCookieString(fields: CookieFields): string {
  const parts: string[] = [];
  if (fields.userSession) parts.push(`user_session=${fields.userSession}`);
  if (fields.hostUserSession) parts.push(`__Host-user_session_same_site=${fields.hostUserSession}`);
  if (fields.loggedIn) parts.push(`logged_in=${fields.loggedIn}`);
  if (fields.ghSess) parts.push(`_gh_sess=${fields.ghSess}`);
  return parts.join('; ');
}

export function CookieForm({ cookieStatus }: CookieFormProps) {
  const [fields, setFields] = useState<CookieFields>({
    userSession: '',
    hostUserSession: '',
    loggedIn: '',
    ghSess: '',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const router = useRouter();

  function updateField(field: keyof CookieFields, value: string) {
    setFields(prev => ({ ...prev, [field]: value }));
  }

  async function handleSaveCookies() {
    if (!fields.userSession.trim()) {
      toast.error('user_session is required');
      return;
    }

    const cookieString = buildCookieString(fields);

    setSaving(true);
    const result = await saveGitHubCookies(cookieString);
    setSaving(false);

    if (result.success) {
      toast.success('Cookies saved successfully');
      setFields({ userSession: '', hostUserSession: '', loggedIn: '', ghSess: '' });
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to save cookies');
    }
  }

  async function handleTestCookies() {
    setTesting(true);
    const result = await testGitHubCookies();
    setTesting(false);

    if (result.success) {
      toast.success(result.message || 'Cookies are valid!');
    } else {
      toast.error(result.error || 'Cookies test failed');
    }
  }

  async function handleClearCookies() {
    if (!confirm('Are you sure you want to clear the GitHub cookies?')) {
      return;
    }

    setClearing(true);
    const result = await clearGitHubCookies();
    setClearing(false);

    if (result.success) {
      toast.success('Cookies cleared');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to clear cookies');
    }
  }

  // Calculate days since update
  const { daysSinceUpdate, isStale } = useMemo(
    () => calculateDaysSinceUpdate(cookieStatus.updatedAt),
    [cookieStatus.updatedAt]
  );

  return (
    <Card className="mb-6 border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Cookie className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-medium">GitHub Session Cookies</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Higher rate limits using web search (optional)
            </CardDescription>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isStale && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-0">
                <AlertTriangle className="h-3 w-3 mr-1" />
                May be expired
              </Badge>
            )}
            <Badge
              className={
                cookieStatus.hasCookies
                  ? 'bg-emerald-500/20 text-emerald-400 border-0'
                  : 'bg-muted text-muted-foreground border-0'
              }
            >
              {cookieStatus.hasCookies ? (
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
        {cookieStatus.hasCookies && cookieStatus.updatedAt && (
          <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last updated: {new Date(cookieStatus.updatedAt).toLocaleDateString()} ({daysSinceUpdate} days ago)
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestCookies}
                disabled={testing}
                className="h-7 text-xs"
              >
                {testing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <TestTube className="h-3 w-3 mr-1" />}
                Test
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCookies}
                disabled={clearing}
                className="h-7 text-xs text-red-400 hover:text-red-300"
              >
                {clearing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                Clear
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Cookie input fields */}
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                user_session <span className="text-red-400">*</span>
              </label>
              <Input
                type="password"
                placeholder="Paste user_session value"
                value={fields.userSession}
                onChange={(e) => updateField('userSession', e.target.value)}
                className="bg-muted border-border text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                __Host-user_session_same_site
              </label>
              <Input
                type="password"
                placeholder="Paste __Host-user_session_same_site value"
                value={fields.hostUserSession}
                onChange={(e) => updateField('hostUserSession', e.target.value)}
                className="bg-muted border-border text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">logged_in</label>
                <Input
                  type="text"
                  placeholder="yes"
                  value={fields.loggedIn}
                  onChange={(e) => updateField('loggedIn', e.target.value)}
                  className="bg-muted border-border text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">_gh_sess</label>
                <Input
                  type="password"
                  placeholder="Optional"
                  value={fields.ghSess}
                  onChange={(e) => updateField('ghSess', e.target.value)}
                  className="bg-muted border-border text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <Button onClick={handleSaveCookies} disabled={saving} size="default" className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {cookieStatus.hasCookies ? 'Update Cookies' : 'Save Cookies'}
          </Button>
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showHelp ? 'rotate-180' : ''}`} />
            How to get these values?
          </button>
          {showHelp && (
            <div className="mt-3 text-xs text-muted-foreground space-y-2">
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Login to <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">github.com</a> in your browser</li>
                <li>Open DevTools (F12) → Application tab → Cookies → github.com</li>
                <li>Find each cookie and copy its <strong>Value</strong> (not the name)</li>
                <li>Paste each value in the corresponding field above</li>
              </ol>
              <p className="pt-2 text-yellow-400/80">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Cookies expire after ~2 weeks or when you logout. You&apos;ll need to update them periodically.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
