'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        pathname={pathname}
      />
      <main
        className={cn(
          'min-h-screen transition-[padding] duration-150 ease-out',
          collapsed ? 'pl-17' : 'pl-56'
        )}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
