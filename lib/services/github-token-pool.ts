import { Octokit } from '@octokit/rest';
import { SearchProviderTokenDB } from '../appwrite/database';
import { SearchProviderToken } from '../providers/types';
import { createLogger } from '../utils/logger';

const log = createLogger('token-pool');

interface TokenState {
  token: SearchProviderToken;
  remaining: number;
  resetAt: Date;
  lastChecked: Date;
}

/**
 * Manages a pool of GitHub tokens with automatic rotation and rate limit handling
 */
export class GitHubTokenPool {
  private tokens: TokenState[] = [];
  private currentIndex = 0;
  private initialized = false;

  /**
   * Initialize the token pool by loading all enabled tokens
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const tokenRecords = await SearchProviderTokenDB.getAllGitHubTokens();

    if (!tokenRecords || tokenRecords.length === 0) {
      throw new Error('No GitHub tokens configured');
    }

    log.info(`Loaded ${tokenRecords.length} GitHub token(s)`);

    // Initialize token states with default values
    this.tokens = tokenRecords.map((token) => ({
      token,
      remaining: 10, // GitHub search API limit per minute
      resetAt: new Date(),
      lastChecked: new Date(0),
    }));

    // Check rate limits for all tokens
    await this.refreshAllRateLimits();

    this.initialized = true;
    log.info(`Token pool initialized with ${this.tokens.length} token(s)`);
  }

  /**
   * Get the best available token (most remaining quota)
   * If all tokens are rate limited, waits for the earliest reset
   */
  async getToken(): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Try to find a token with remaining quota
    const availableToken = this.findBestToken();
    if (availableToken) {
      return availableToken.token.token;
    }

    // All tokens rate limited - wait for earliest reset
    const earliestReset = this.getEarliestReset();
    const waitMs = Math.max(0, earliestReset.getTime() - Date.now() + 1000); // +1s buffer

    log.warn(`All tokens rate limited. Waiting ${Math.ceil(waitMs / 1000)}s until ${earliestReset.toISOString()}`);

    await this.sleep(waitMs);

    // Refresh rate limits after waiting
    await this.refreshAllRateLimits();

    // Try again
    const tokenAfterWait = this.findBestToken();
    if (tokenAfterWait) {
      return tokenAfterWait.token.token;
    }

    // Fallback to first token
    return this.tokens[0].token.token;
  }

  /**
   * Mark a token as rate limited
   */
  markRateLimited(token: string, resetAt: Date): void {
    const state = this.tokens.find((t) => t.token.token === token);
    if (state) {
      state.remaining = 0;
      state.resetAt = resetAt;
      state.lastChecked = new Date();
      log.debug(`Token marked rate limited until ${resetAt.toISOString()}`);
    }
  }

  /**
   * Decrement remaining count for a token (call after each API request)
   */
  decrementRemaining(token: string): void {
    const state = this.tokens.find((t) => t.token.token === token);
    if (state && state.remaining > 0) {
      state.remaining--;
    }
  }

  /**
   * Get the number of available tokens
   */
  getTokenCount(): number {
    return this.tokens.length;
  }

  /**
   * Get rate limit status for all tokens
   */
  getStatus(): { available: number; total: number; nextReset: Date | null } {
    const available = this.tokens.filter((t) => t.remaining > 0).length;
    const nextReset = available === 0 ? this.getEarliestReset() : null;
    return { available, total: this.tokens.length, nextReset };
  }

  /**
   * Find the token with the most remaining quota
   */
  private findBestToken(): TokenState | null {
    const now = new Date();

    // Reset tokens whose reset time has passed
    for (const state of this.tokens) {
      if (state.remaining === 0 && state.resetAt <= now) {
        state.remaining = 10; // Reset to default quota
      }
    }

    // Sort by remaining quota (descending)
    const available = this.tokens
      .filter((t) => t.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);

    return available.length > 0 ? available[0] : null;
  }

  /**
   * Get the earliest rate limit reset time
   */
  private getEarliestReset(): Date {
    const resetTimes = this.tokens.map((t) => t.resetAt);
    return new Date(Math.min(...resetTimes.map((d) => d.getTime())));
  }

  /**
   * Refresh rate limits for all tokens
   */
  private async refreshAllRateLimits(): Promise<void> {
    const checkPromises = this.tokens.map(async (state) => {
      try {
        const octokit = new Octokit({ auth: state.token.token });
        const response = await octokit.rateLimit.get();
        const searchLimit = response.data.resources.search;

        state.remaining = searchLimit.remaining;
        state.resetAt = new Date(searchLimit.reset * 1000);
        state.lastChecked = new Date();

        log.debug(`Token rate limit: ${searchLimit.remaining}/${searchLimit.limit}, resets at ${state.resetAt.toISOString()}`);
      } catch (err) {
        log.error(`Failed to check rate limit: ${err instanceof Error ? err.message : String(err)}`);
        // Keep existing state on error
      }
    });

    await Promise.all(checkPromises);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let tokenPoolInstance: GitHubTokenPool | null = null;

/**
 * Get or create the GitHub token pool singleton
 */
export function getGitHubTokenPool(): GitHubTokenPool {
  if (!tokenPoolInstance) {
    tokenPoolInstance = new GitHubTokenPool();
  }
  return tokenPoolInstance;
}

/**
 * Reset the token pool (useful for testing or when tokens change)
 */
export function resetGitHubTokenPool(): void {
  tokenPoolInstance = null;
}
