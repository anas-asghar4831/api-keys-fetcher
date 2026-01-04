'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CollapseButtonProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function CollapseButton({ collapsed, onToggle }: CollapseButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className="absolute top-4 -right-3 h-6 w-6 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent shadow-sm z-50 transition-colors duration-150 ease-out"
    >
      {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
    </Button>
  );
}
