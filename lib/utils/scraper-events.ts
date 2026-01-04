export type ScraperEventType =
  | 'start'
  | 'query_selected'
  | 'search_started'
  | 'search_complete'
  | 'page_fetching'
  | 'page_fetched'
  | 'file_processing'
  | 'file_fetching'
  | 'file_fetched'
  | 'file_processed'
  | 'key_found'
  | 'key_checking'
  | 'key_duplicate'
  | 'key_saved'
  | 'info'
  | 'warning'
  | 'error'
  | 'rate_limited'
  | 'complete';

export interface ScraperEvent {
  type: ScraperEventType;
  timestamp: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface ScraperProgress {
  status: 'running' | 'complete' | 'error';
  currentQuery: string;
  totalResults: number;
  processedFiles: number;
  totalFiles: number;
  newKeys: number;
  duplicates: number;
  errors: number;
  events: ScraperEvent[];
}

export function createEvent(
  type: ScraperEventType,
  message: string,
  data?: Record<string, unknown>
): ScraperEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    message,
    data,
  };
}

export function createInitialProgress(): ScraperProgress {
  return {
    status: 'running',
    currentQuery: '',
    totalResults: 0,
    processedFiles: 0,
    totalFiles: 0,
    newKeys: 0,
    duplicates: 0,
    errors: 0,
    events: [],
  };
}
