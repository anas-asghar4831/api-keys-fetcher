'use client';

import { Menu, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileHeaderProps {
  onMenuToggle: () => void;
}

export function MobileHeader({ onMenuToggle }: MobileHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-14 border-b border-border bg-sidebar md:hidden">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <span className="font-semibold text-sm">KeyGuard</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          className="h-9 w-9"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </div>
    </header>
  );
}
