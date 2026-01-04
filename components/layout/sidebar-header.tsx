import { Key } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarHeaderProps {
  collapsed: boolean;
}

export function SidebarHeader({ collapsed }: SidebarHeaderProps) {
  return (
    <div className={cn(
      'flex h-14 items-center px-3 border-b border-border overflow-hidden transition-[padding] duration-150 ease-out',
      collapsed ? 'pl-4' : ''
    )}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
        <Key className="h-4 w-4 text-primary-foreground" />
      </div>
      <span className="text-sm font-semibold tracking-tight whitespace-nowrap ml-2.5">
        KeyGuard
      </span>
    </div>
  );
}
