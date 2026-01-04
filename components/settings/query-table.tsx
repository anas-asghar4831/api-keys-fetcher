'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Search, RotateCcw, Loader2, Database } from 'lucide-react';
import { toggleSearchQuery, initializeDatabase, SearchQuery } from '@/lib/actions/settings';
import { useRouter } from 'next/navigation';

interface QueryTableProps {
  searchQueries: SearchQuery[];
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function QueryTable({ searchQueries }: QueryTableProps) {
  const [initializing, setInitializing] = useState(false);
  const router = useRouter();

  async function handleToggleQuery(queryId: string, currentEnabled: boolean) {
    const result = await toggleSearchQuery(queryId, !currentEnabled);

    if (result.success) {
      toast.success(`Query ${currentEnabled ? 'disabled' : 'enabled'}`);
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to update query');
    }
  }

  async function handleInitializeDatabase() {
    setInitializing(true);
    const result = await initializeDatabase();
    setInitializing(false);

    if (result.success) {
      toast.success('Database initialized');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to initialize database');
    }
  }

  return (
    <Card className="mb-6 border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Search className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base font-medium">Search Queries</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Patterns used to find API keys on GitHub
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleInitializeDatabase}
            disabled={initializing}
            className="text-xs"
          >
            {initializing ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3 mr-1.5" />
            )}
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {searchQueries && searchQueries.length > 0 ? (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-xs font-medium text-muted-foreground">Query</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-right">Results</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Last Run</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchQueries.map((query) => (
                  <TableRow key={query.id} className="border-border">
                    <TableCell className="font-mono text-xs">{query.query}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          query.isEnabled
                            ? 'bg-emerald-500/20 text-emerald-400 border-0'
                            : 'bg-zinc-500/20 text-zinc-400 border-0'
                        }
                      >
                        {query.isEnabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground text-right">
                      {query.searchResultsCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(query.lastSearchUtc)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleToggleQuery(query.id, query.isEnabled)}
                      >
                        {query.isEnabled ? 'Disable' : 'Enable'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm mb-3">No search queries configured</p>
            <Button variant="outline" size="sm" onClick={handleInitializeDatabase} disabled={initializing}>
              {initializing ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <Database className="h-3 w-3 mr-1.5" />
              )}
              Initialize Database
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
