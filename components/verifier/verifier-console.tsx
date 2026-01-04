'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Square,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Key,
  Trash2,
  RefreshCw,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerificationLog {
  timestamp: string;
  keyId: string;
  maskedKey: string;
  provider: string;
  result: 'valid' | 'invalid' | 'no_credits' | 'error';
  message: string;
}

interface VerifierStatus {
  validCount: number;
  unverifiedCount: number;
  maxValidKeys: number;
  atCapacity: boolean;
}

interface BatchResult {
  status: 'success' | 'error';
  verified: number;
  valid: number;
  invalid: number;
  validNoCredits: number;
  logs: VerificationLog[];
  error?: string;
}

const BATCH_SIZE = 15;

const RESULT_ICONS: Record<string, React.ReactNode> = {
  valid: <CheckCircle2 className="h-3 w-3 text-success" />,
  invalid: <XCircle className="h-3 w-3 text-destructive" />,
  no_credits: <AlertCircle className="h-3 w-3 text-warning" />,
  error: <XCircle className="h-3 w-3 text-destructive" />,
  system: <Zap className="h-3 w-3 text-primary" />,
};

export function VerifierConsole() {
  const [status, setStatus] = useState<VerifierStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [stats, setStats] = useState({ verified: 0, valid: 0, invalid: 0, noCredits: 0 });
  const [batchesCompleted, setBatchesCompleted] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [lastRunTime, setLastRunTime] = useState<string | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  // Load status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/verifier?action=status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load verifier status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addLog = (log: VerificationLog) => {
    setLogs((prev) => [...prev, log]);
  };

  const addSystemLog = (message: string, result: VerificationLog['result'] = 'valid') => {
    addLog({
      timestamp: new Date().toISOString(),
      keyId: 'system',
      maskedKey: '',
      provider: 'System',
      result,
      message,
    });
  };

  const clearConsole = () => {
    setLogs([]);
    setProgress({ current: 0, total: 0 });
    setStats({ verified: 0, valid: 0, invalid: 0, noCredits: 0 });
    setBatchesCompleted(0);
    setTotalBatches(0);
    setLastRunTime(null);
  };

  const runVerifyAll = async () => {
    if (!status || status.unverifiedCount === 0) return;

    setIsRunning(true);
    setLogs([]);
    setStats({ verified: 0, valid: 0, invalid: 0, noCredits: 0 });
    setBatchesCompleted(0);
    abortRef.current = false;

    const unverifiedCount = status.unverifiedCount;
    const numBatches = Math.ceil(unverifiedCount / BATCH_SIZE);
    setTotalBatches(numBatches);
    setProgress({ current: 0, total: unverifiedCount });

    addSystemLog(`Starting verification of ${unverifiedCount} keys in ${numBatches} parallel batches`);
    setLastRunTime(new Date().toISOString());

    try {
      // Fire all batches in parallel
      const batchPromises: Promise<BatchResult>[] = [];

      for (let i = 0; i < numBatches; i++) {
        if (abortRef.current) break;

        addSystemLog(`Starting batch ${i + 1}/${numBatches}...`);

        const promise = fetch('/api/verifier', { method: 'POST' })
          .then((res) => res.json())
          .then((result: BatchResult) => {
            if (abortRef.current) return result;

            // Update stats
            setStats((prev) => ({
              verified: prev.verified + result.verified,
              valid: prev.valid + result.valid,
              invalid: prev.invalid + result.invalid,
              noCredits: prev.noCredits + result.validNoCredits,
            }));

            // Update progress
            setProgress((prev) => ({
              ...prev,
              current: Math.min(prev.current + result.verified, prev.total),
            }));

            // Add logs from this batch
            for (const log of result.logs) {
              addLog(log);
            }

            setBatchesCompleted((prev) => prev + 1);

            addSystemLog(
              `Batch complete: ${result.verified} verified (${result.valid} valid, ${result.invalid} invalid, ${result.validNoCredits} no credits)`
            );

            return result;
          })
          .catch((err) => {
            addSystemLog(`Batch error: ${err.message}`, 'error');
            return {
              status: 'error' as const,
              verified: 0,
              valid: 0,
              invalid: 0,
              validNoCredits: 0,
              logs: [],
              error: err.message,
            };
          });

        batchPromises.push(promise);
      }

      // Wait for all batches
      await Promise.all(batchPromises);

      if (abortRef.current) {
        addSystemLog('Verification stopped by user', 'error');
      } else {
        addSystemLog(
          `Verification complete! ${stats.verified} keys processed`,
          'valid'
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addSystemLog(`Error: ${message}`, 'error');
    } finally {
      setIsRunning(false);
      loadStatus(); // Refresh status
    }
  };

  const stopVerification = () => {
    abortRef.current = true;
    addSystemLog('Stopping verification...', 'error');
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm md:text-base font-medium">Verifier Console</CardTitle>
            {isRunning && (
              <Badge className="bg-success/20 text-success border-0 animate-pulse">
                Running
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Stats */}
            {status && (
              <div className="flex items-center gap-2 md:gap-3 text-xs text-muted-foreground mr-2">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {status.unverifiedCount}
                </span>
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  {status.validCount}
                </span>
              </div>
            )}

            {/* Session stats when running */}
            {stats.verified > 0 && (
              <div className="flex items-center gap-2 text-xs mr-2">
                <span className="text-success">{stats.valid}</span>
                <span className="text-destructive">{stats.invalid}</span>
                <span className="text-warning">{stats.noCredits}</span>
              </div>
            )}

            {logs.length > 0 && !isRunning && (
              <Button size="sm" variant="ghost" onClick={clearConsole} className="h-8">
                <Trash2 className="h-3 w-3 sm:mr-1.5" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}

            <Button size="sm" variant="ghost" onClick={loadStatus} disabled={isRunning} className="h-8">
              <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
            </Button>

            {isRunning ? (
              <Button size="sm" variant="destructive" onClick={stopVerification} className="h-8">
                <Square className="h-3 w-3 sm:mr-1.5" />
                <span className="hidden sm:inline">Stop</span>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={runVerifyAll}
                disabled={!status || status.unverifiedCount === 0}
                className="h-8"
              >
                <Play className="h-3 w-3 sm:mr-1.5" />
                <span className="hidden sm:inline">Verify All</span> ({status?.unverifiedCount || 0})
              </Button>
            )}
          </div>
        </div>

        {/* Last run time */}
        {!isRunning && lastRunTime && (
          <p className="text-xs text-muted-foreground mt-2">
            Last run: {new Date(lastRunTime).toLocaleString()}
          </p>
        )}

        {/* Progress bar */}
        {(isRunning || progress.total > 0) && progress.total > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress.current} / {progress.total} keys</span>
              <span>Batch {batchesCompleted} / {totalBatches}</span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>
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
              Loading...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Click "Verify All" to start verification...</p>
              {status && status.unverifiedCount === 0 && (
                <p className="mt-2 text-success">No unverified keys to process</p>
              )}
            </div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 py-0.5',
                  log.result === 'valid' && 'text-success',
                  log.result === 'invalid' && 'text-destructive',
                  log.result === 'no_credits' && 'text-warning',
                  log.result === 'error' && 'text-destructive',
                  log.keyId === 'system' && 'text-primary'
                )}
              >
                <span className="text-muted-foreground/50 shrink-0">
                  {formatTime(log.timestamp)}
                </span>
                <span className="shrink-0">
                  {log.keyId === 'system'
                    ? RESULT_ICONS.system
                    : RESULT_ICONS[log.result] || <Key className="h-3 w-3" />}
                </span>
                {log.keyId !== 'system' && (
                  <>
                    <span className="text-muted-foreground shrink-0">{log.provider}</span>
                    <code className="text-muted-foreground/70 shrink-0">{log.maskedKey}</code>
                  </>
                )}
                <span className="break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>

        {/* Summary stats */}
        {stats.verified > 0 && !isRunning && (
          <div className="mt-3 flex items-center justify-center gap-6 text-sm">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="font-medium">{stats.valid}</span>
              <span className="text-muted-foreground">valid</span>
            </span>
            <span className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="font-medium">{stats.invalid}</span>
              <span className="text-muted-foreground">invalid</span>
            </span>
            <span className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span className="font-medium">{stats.noCredits}</span>
              <span className="text-muted-foreground">no credits</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
