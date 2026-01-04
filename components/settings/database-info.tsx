import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Database } from 'lucide-react';

export function DatabaseInfo() {
  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-medium">Database</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Appwrite backend configuration
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <Label className="text-muted-foreground text-xs">Environment Variables</Label>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li><code className="text-primary">NEXT_PUBLIC_APPWRITE_ENDPOINT</code></li>
              <li><code className="text-primary">NEXT_PUBLIC_APPWRITE_PROJECT</code></li>
              <li><code className="text-primary">APPWRITE_API_KEY</code></li>
              <li><code className="text-primary">APPWRITE_DATABASE_ID</code></li>
            </ul>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Collections</Label>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>api_keys</li>
              <li>repo_references</li>
              <li>search_queries</li>
              <li>search_provider_tokens</li>
              <li>application_settings</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
