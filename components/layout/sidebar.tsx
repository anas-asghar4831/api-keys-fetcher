import { cn } from '@/lib/utils';
import { SidebarHeader } from './sidebar-header';
import { SidebarNav } from './sidebar-nav';
import { SidebarFooter } from './sidebar-footer';
import { CollapseButton } from './collapse-button';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  pathname: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ collapsed, onToggle, pathname, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 h-screen border-r border-border bg-sidebar flex flex-col',
        'transition-all duration-200 ease-out',
        // Mobile: slide in/out from left
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: width based on collapsed state
        collapsed ? 'md:w-17' : 'md:w-56',
        // Mobile: always full width when open
        'w-64'
      )}
    >
      {/* Mobile close button */}
      <div className="md:hidden absolute top-3 right-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close menu</span>
        </Button>
      </div>

      <SidebarHeader collapsed={collapsed} />
      <CollapseButton collapsed={collapsed} onToggle={onToggle} className="hidden md:flex" />
      <SidebarNav collapsed={collapsed} pathname={pathname} />
      <SidebarFooter collapsed={collapsed} />
    </aside>
  );
}
