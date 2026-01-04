import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KeysTable } from './keys-table';
import { Statistics, ApiKeyData } from '@/lib/actions/dashboard';

interface KeysTabsProps {
  stats: Statistics;
  validKeys: ApiKeyData[];
  invalidKeys: ApiKeyData[];
  pendingKeys: ApiKeyData[];
  noCreditsKeys: ApiKeyData[];
}

export function KeysTabs({ stats, validKeys, invalidKeys, pendingKeys, noCreditsKeys }: KeysTabsProps) {
  return (
    <Card className="border-border">
      <Tabs defaultValue="valid" className="w-full">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">API Keys</CardTitle>
            <TabsList className="h-8 bg-muted/50">
              <TabsTrigger value="valid" className="text-xs h-7 px-3">
                Valid ({stats.valid})
              </TabsTrigger>
              <TabsTrigger value="no-credits" className="text-xs h-7 px-3">
                No Credits ({stats.validNoCredits})
              </TabsTrigger>
              <TabsTrigger value="invalid" className="text-xs h-7 px-3">
                Invalid ({stats.invalid})
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs h-7 px-3">
                Pending ({stats.unverified})
              </TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <TabsContent value="valid" className="mt-0">
            <KeysTable keys={validKeys} />
          </TabsContent>
          <TabsContent value="no-credits" className="mt-0">
            <KeysTable keys={noCreditsKeys} />
          </TabsContent>
          <TabsContent value="invalid" className="mt-0">
            <KeysTable keys={invalidKeys} />
          </TabsContent>
          <TabsContent value="pending" className="mt-0">
            <KeysTable keys={pendingKeys} />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
