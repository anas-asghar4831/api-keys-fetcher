import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Key, CheckCircle2, XCircle, Clock, AlertCircle, CreditCard } from 'lucide-react';
import { ApiKeyData } from '@/lib/actions/dashboard';

const STATUS_CONFIG: Record<number, { label: string; color: string; icon: React.ReactNode }> = {
  [-99]: { label: 'Pending', color: 'bg-zinc-500/20 text-zinc-400', icon: <Clock className="h-3 w-3" /> },
  [0]: { label: 'Invalid', color: 'bg-red-500/20 text-red-400', icon: <XCircle className="h-3 w-3" /> },
  [1]: { label: 'Valid', color: 'bg-emerald-500/20 text-emerald-400', icon: <CheckCircle2 className="h-3 w-3" /> },
  [6]: { label: 'Error', color: 'bg-amber-500/20 text-amber-400', icon: <AlertCircle className="h-3 w-3" /> },
  [7]: { label: 'No Credits', color: 'bg-blue-500/20 text-blue-400', icon: <CreditCard className="h-3 w-3" /> },
};

function maskApiKey(key: string): string {
  if (!key || key.length <= 16) return key;
  return `${key.slice(0, 12)}${'•'.repeat(8)}${key.slice(-4)}`;
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function KeysTable({ keys }: { keys: ApiKeyData[] }) {
  if (keys.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Key className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No keys found</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="text-xs font-medium text-muted-foreground">API Key</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">Found</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">Checked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => {
            const config = STATUS_CONFIG[key.status] || STATUS_CONFIG[-99];
            return (
              <TableRow key={key.$id} className="border-border">
                <TableCell className="font-mono text-xs">
                  {maskApiKey(key.apiKey)}
                </TableCell>
                <TableCell>
                  <Badge className={`${config.color} border-0 gap-1`}>
                    {config.icon}
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(key.firstFoundUtc)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(key.lastCheckedUtc)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
