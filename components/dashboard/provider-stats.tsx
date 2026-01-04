import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ProviderStats({ byType }: { byType: Record<string, number> }) {
  if (!byType || Object.keys(byType).length === 0) {
    return null;
  }

  return (
    <Card className="mt-6 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">By Provider</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {Object.entries(byType)
            .sort(([, a], [, b]) => b - a)
            .map(([provider, count]) => (
              <Badge
                key={provider}
                variant="secondary"
                className="bg-muted text-foreground border-0"
              >
                {provider}
                <span className="ml-1.5 text-primary">{count}</span>
              </Badge>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
