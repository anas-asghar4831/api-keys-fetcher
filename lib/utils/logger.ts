export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, unknown>;
}

export type LogHandler = (entry: LogEntry) => void;

class Logger {
  private handlers: LogHandler[] = [];
  private context: string = 'app';

  constructor(context?: string) {
    if (context) this.context = context;
  }

  addHandler(handler: LogHandler) {
    this.handlers.push(handler);
  }

  removeHandler(handler: LogHandler) {
    this.handlers = this.handlers.filter(h => h !== handler);
  }

  clearHandlers() {
    this.handlers = [];
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      data,
    };

    // Console output with colors
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${this.context}]`;

    switch (level) {
      case 'debug':
        console.debug(`\x1b[90m${prefix}\x1b[0m`, message, data || '');
        break;
      case 'info':
        console.info(`\x1b[36m${prefix}\x1b[0m`, message, data || '');
        break;
      case 'warn':
        console.warn(`\x1b[33m${prefix}\x1b[0m`, message, data || '');
        break;
      case 'error':
        console.error(`\x1b[31m${prefix}\x1b[0m`, message, data || '');
        break;
    }

    // Notify handlers
    this.handlers.forEach(handler => handler(entry));
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.log('error', message, data);
  }

  child(context: string): Logger {
    const childLogger = new Logger(`${this.context}:${context}`);
    this.handlers.forEach(h => childLogger.addHandler(h));
    return childLogger;
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}

export const logger = new Logger('app');
