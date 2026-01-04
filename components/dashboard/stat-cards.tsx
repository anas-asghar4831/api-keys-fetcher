import { Card, CardContent } from '@/components/ui/card';
import { Key, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Statistics } from '@/lib/actions/dashboard';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-semibold mt-1 ${color}`}>{value.toLocaleString()}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatCards({ stats }: { stats: Statistics }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        title="Total Keys"
        value={stats.total}
        icon={<Key className="h-4 w-4 text-muted-foreground" />}
        color="text-foreground"
      />
      <StatCard
        title="Valid"
        value={stats.valid}
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        color="text-emerald-400"
      />
      <StatCard
        title="Invalid"
        value={stats.invalid}
        icon={<XCircle className="h-4 w-4 text-red-400" />}
        color="text-red-400"
      />
      <StatCard
        title="Pending"
        value={stats.unverified}
        icon={<Clock className="h-4 w-4 text-zinc-400" />}
        color="text-zinc-400"
      />
    </div>
  );
}
