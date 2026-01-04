'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Terminal, CheckCircle2, XCircle, AlertCircle, Key, Copy, Download, FileSearch, Search, AlertTriangle, Trash2, RefreshCw, FileText, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScraperEvent, ScraperProgress } from '@/lib/utils/scraper-events';

interface ScraperConsoleProps {
  hasToken: boolean;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  start: <Play className="h-3 w-3 text-primary" />,
  complete: <CheckCircle2 className="h-3 w-3 text-success" />,
  error: <XCircle className="h-3 w-3 text-destructive" />,
  rate_limited: <AlertCircle className="h-3 w-3 text-warning" />,
  // Query events
  query_selected: <Search className="h-3 w-3 text-primary" />,
  search_started: <Search className="h-3 w-3 text-primary" />,
  search_complete: <CheckCircle2 className="h-3 w-3 text-primary" />,
  // Page events
  page_fetching: <FileText className="h-3 w-3 text-muted-foreground" />,
  page_fetched: <FileText className="h-3 w-3 text-primary" />,
  // File events
  file_processing: <FileSearch className="h-3 w-3 text-muted-foreground" />,
  file_fetching: <Download className="h-3 w-3 text-muted-foreground" />,
  file_fetched: <Download className="h-3 w-3 text-primary" />,
  file_processed: <CheckCircle2 className="h-3 w-3 text-muted-foreground" />,
  // Key events
  key_found: <Key className="h-3 w-3 text-primary" />,
  key_checking: <Key className="h-3 w-3 text-muted-foreground" />,
  key_duplicate: <Copy className="h-3 w-3 text-muted-foreground" />,
  key_saved: <Key className="h-3 w-3 text-success" />,
  // Info/warning
  info: <Clock className="h-3 w-3 text-muted-foreground" />,
  warning: <AlertTriangle className="h-3 w-3 text-warning" />,
};

export function ScraperConsole({ hasToken }: ScraperConsoleProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<ScraperEvent[]>([]);
  const [progress, setProgress] = useState<ScraperProgress | null>(null);
  const [lastRunTime, setLastRunTime] = useState<string | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load last run from database on mount
  const loadLastRun = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/scraper/runs');
      const data = await response.json();

      if (data.run) {
        setEvents(data.run.events || []);
        setProgress({
          status: data.run.status,
          currentQuery: data.run.query,
          totalResults: data.run.totalResults,
          processedFiles: data.run.processedFiles,
          totalFiles: data.run.totalFiles,
          newKeys: data.run.newKeys,
          duplicates: data.run.duplicates,
          errors: data.run.errors,
          events: data.run.events || [],
        });
        setLastRunTime(data.run.completedAt || data.run.startedAt);
      }
    } catch {
      // Ignore fetch errors
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLastRun();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [events]);

  const clearConsole = async () => {
    try {
      await fetch('/api/scraper/runs', { method: 'DELETE' });
      setEvents([]);
      setProgress(null);
      setLastRunTime(null);
    } catch {
      // Ignore errors
    }
  };

  const startScraper = async () => {
    if (!hasToken) return;

    setIsRunning(true);
    setEvents([]);
    setProgress(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/scraper/stream', {
        signal: abortControllerRef.current.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.event) {
                setEvents(prev => [...prev, data.event]);
              }
              if (data.progress) {
                setProgress(data.progress);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setEvents(prev => [...prev, {
          type: 'error',
          timestamp: new Date().toISOString(),
          message: `Connection error: ${err.message}`,
        }]);
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const stopScraper = () => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm md:text-base font-medium">Scraper Console</CardTitle>
            {isRunning && (
              <Badge className="bg-success/20 text-success border-0 animate-pulse">
                Running
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {progress && (
              <div className="flex items-center gap-2 md:gap-3 text-xs text-muted-foreground mr-2">
                <span className="hidden sm:inline">Files: {progress.processedFiles}/{progress.totalFiles}</span>
                <span className="text-success">+{progress.newKeys}</span>
                <span className="text-muted-foreground">{progress.duplicates} dupe</span>
                {progress.errors > 0 && (
                  <span className="text-destructive">{progress.errors} err</span>
                )}
              </div>
            )}
            {events.length > 0 && !isRunning && (
              <Button size="sm" variant="ghost" onClick={clearConsole} className="h-8">
                <Trash2 className="h-3 w-3 sm:mr-1.5" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
            {isRunning ? (
              <Button size="sm" variant="destructive" onClick={stopScraper} className="h-8">
                <Square className="h-3 w-3 sm:mr-1.5" />
                <span className="hidden sm:inline">Stop</span>
              </Button>
            ) : (
              <Button size="sm" onClick={startScraper} disabled={!hasToken} className="h-8">
                <Play className="h-3 w-3 sm:mr-1.5" />
                <span className="hidden sm:inline">Run Scraper</span>
              </Button>
            )}
          </div>
        </div>
        {/* Last run time - shown on separate line on mobile */}
        {!isRunning && lastRunTime && (
          <p className="text-xs text-muted-foreground mt-2">
            Last run: {new Date(lastRunTime).toLocaleString()}
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div
          ref={consoleRef}
          className="bg-background rounded-lg p-2 md:p-3 h-64 md:h-96 overflow-y-auto font-mono text-xs border border-border"
        >
          {isLoading ? (
            <div className="text-muted-foreground text-center py-8 flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading last run...
            </div>
          ) : events.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              Click &quot;Run Scraper&quot; to start...
            </div>
          ) : (
            events.map((event, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 py-0.5',
                  // Error states
                  event.type === 'error' && 'text-destructive',
                  event.type === 'rate_limited' && 'text-warning',
                  event.type === 'warning' && 'text-warning',
                  // Success states
                  event.type === 'key_saved' && 'text-success',
                  event.type === 'complete' && 'text-success',
                  // Highlighted states
                  event.type === 'key_found' && 'text-primary',
                  event.type === 'search_complete' && 'text-primary',
                  event.type === 'file_fetched' && 'text-foreground',
                  // Default
                  !['error', 'rate_limited', 'warning', 'key_saved', 'complete', 'key_found', 'search_complete', 'file_fetched'].includes(event.type) && 'text-muted-foreground'
                )}
              >
                <span className="text-muted-foreground/50 shrink-0">{formatTime(event.timestamp)}</span>
                <span className="shrink-0">{EVENT_ICONS[event.type] || <Terminal className="h-3 w-3" />}</span>
                <span className="break-all">{event.message}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
