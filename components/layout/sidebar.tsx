import { cn } from '@/lib/utils';
import { SidebarHeader } from './sidebar-header';
import { SidebarNav } from './sidebar-nav';
import { SidebarFooter } from './sidebar-footer';
import { CollapseButton } from './collapse-button';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  pathname: string;
}

export function Sidebar({ collapsed, onToggle, pathname }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar flex flex-col',
        'transition-[width] duration-150 ease-out',
        collapsed ? 'w-17' : 'w-56'
      )}
    >
      <SidebarHeader collapsed={collapsed} />
      <CollapseButton collapsed={collapsed} onToggle={onToggle} />
      <SidebarNav collapsed={collapsed} pathname={pathname} />
      <SidebarFooter collapsed={collapsed} />
    </aside>
  );
}
