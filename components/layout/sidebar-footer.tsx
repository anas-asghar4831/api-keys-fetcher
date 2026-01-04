import { cn } from '@/lib/utils';

interface SidebarFooterProps {
  collapsed: boolean;
}

export function SidebarFooter({ collapsed }: SidebarFooterProps) {
  return (
    <div className={cn(
      'border-t border-border p-3 overflow-hidden transition-[padding] duration-150 ease-out',
      collapsed && 'px-2'
    )}>
      <div className={cn(
        'flex items-center px-4 gap-2 text-xs text-muted-foreground transition-[gap] duration-150 ease-out',
        collapsed ? 'pl-4 gap-16' : ''
      )}>
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span className="whitespace-nowrap">System Online</span>
      </div>
    </div>
  );
}
