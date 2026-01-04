/**
 * String utility functions optimized for API key handling
 */

/**
 * Mask API key showing only first 4 and last 4 characters
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 8) {
    return apiKey || '';
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

/**
 * Truncate string to specified length with ellipsis
 */
export function truncate(text: string | undefined | null, maxLength: number = 200): string {
  if (!text || text.length <= maxLength) {
    return text ?? '';
  }
  return text.slice(0, maxLength) + '...';
}

/**
 * Clean API key by removing common prefixes
 */
export function cleanApiKey(apiKey: string): string {
  if (!apiKey) return '';

  let key = apiKey.trim();

  // Remove Bearer prefix
  if (key.toLowerCase().startsWith('bearer ')) {
    key = key.slice(7).trim();
  }

  // Remove x-api-key: prefix
  if (key.toLowerCase().startsWith('x-api-key:')) {
    key = key.slice(10).trim();
  }

  // Remove quotes
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  return key;
}

/**
 * Check if text contains any of the given indicators (case-insensitive)
 */
export function containsAny(text: string, indicators: string[]): boolean {
  const lower = text.toLowerCase();
  return indicators.some((indicator) => lower.includes(indicator.toLowerCase()));
}

/**
 * Extract all matches of a regex pattern from text
 */
export function extractMatches(text: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  const regex = new RegExp(pattern.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match[0] && !matches.includes(match[0])) {
      matches.push(match[0]);
    }
  }

  return matches;
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date | undefined): string {
  if (!date) return 'N/A';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) return 'Invalid date';

  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date | undefined): string {
  if (!date) return 'N/A';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) return 'Invalid date';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return formatDate(d);
}

/**
 * Escape string for CSV export
 */
export function escapeCSV(value: string | undefined | null): string {
  if (!value) return '';

  // If value contains comma, newline, or quote, wrap in quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
