import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Settings, LayoutDashboard, Terminal, Zap } from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    title: 'Scraper',
    href: '/scraper',
    icon: <Terminal className="h-5 w-5" />,
  },
  {
    title: 'Verifier',
    href: '/verifier',
    icon: <Zap className="h-5 w-5" />,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />,
  },
];

interface SidebarNavProps {
  collapsed: boolean;
  pathname: string;
}

export function SidebarNav({ collapsed, pathname }: SidebarNavProps) {
  return (
    <nav className="flex-1 space-y-1 pt-4 transition-[padding] duration-150 ease-out px-3">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center rounded-lg py-2.5 gap-3 px-2 text-sm font-medium overflow-hidden transition-[padding,justify-content] duration-150 ease-out',
              isActive
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              collapsed ? 'pl-3' : ''
            )}
            title={collapsed ? item.title : undefined}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="whitespace-nowrap">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
