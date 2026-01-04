import {
  IApiKeyProvider,
  ApiTypeEnum,
  ProviderMetadata,
  ValidationResult,
  ValidationAttemptStatus,
  KeyDetails,
  ModelInfo,
} from './types';
import { ValidationResultFactory } from './validation-result';

// Default configuration
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30000;

// Common indicators for response body parsing
const QUOTA_INDICATORS = new Set([
  'credit',
  'quota',
  'billing',
  'insufficient_funds',
  'payment',
  'exceeded',
  'balance',
  'limit',
  'insufficient_quota',
  'resource_exhausted',
  'rate_limit',
  'usage_limit',
]);

const UNAUTHORIZED_INDICATORS = new Set([
  'invalid_api_key',
  'authentication_error',
  'unauthorized',
  'api key not valid',
  'api key expired',
  'invalid token',
  'invalid x-api-key',
  'api_key_invalid',
  'authentication failed',
  'token_revoked',
]);

const PERMISSION_INDICATORS = new Set([
  'permission',
  'access',
  'not_authorized',
  'forbidden',
  'read-only',
  'scope',
]);

/**
 * Abstract base class for API key providers with common functionality
 */
export abstract class BaseApiKeyProvider implements IApiKeyProvider {
  abstract providerName: string;
  abstract apiType: ApiTypeEnum;
  abstract regexPatterns: RegExp[];
  abstract metadata: ProviderMetadata;

  /**
   * Provider-specific validation logic - must be implemented by subclasses
   */
  protected abstract validateKeyWithHttp(apiKey: string): Promise<ValidationResult>;

  /**
   * Override to customize key format validation
   */
  protected isValidKeyFormat(apiKey: string): boolean {
    return !!apiKey?.trim() && apiKey.length >= 10;
  }

  /**
   * Override to customize max retries
   */
  protected getMaxRetries(): number {
    return DEFAULT_MAX_RETRIES;
  }

  /**
   * Override to customize timeout
   */
  protected getTimeoutMs(): number {
    return DEFAULT_TIMEOUT_MS;
  }

  /**
   * Main validation entry point with retry logic
   */
  async validateKey(apiKey: string): Promise<ValidationResult> {
    if (!apiKey?.trim()) {
      return ValidationResultFactory.providerError('Empty API key provided');
    }

    const cleanedKey = this.cleanApiKey(apiKey);

    if (!this.isValidKeyFormat(cleanedKey)) {
      return ValidationResultFactory.providerError(
        `Invalid key format for ${this.providerName}`
      );
    }

    // Retry loop with exponential backoff
    for (let retry = 0; retry < this.getMaxRetries(); retry++) {
      if (retry > 0) {
        const delay = Math.pow(2, retry - 1) * 1000; // 1s, 2s, 4s
        await this.sleep(delay);
      }

      try {
        const result = await this.validateKeyWithHttp(cleanedKey);

        // Only retry on network errors
        if (result.status !== ValidationAttemptStatus.NetworkError) {
          return result;
        }

        // Log retry attempt
        console.log(
          `[${this.providerName}] Network error on attempt ${retry + 1}/${this.getMaxRetries()}`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check for timeout
        if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
          console.log(
            `[${this.providerName}] Timeout on attempt ${retry + 1}/${this.getMaxRetries()}`
          );
          if (retry === this.getMaxRetries() - 1) {
            return ValidationResultFactory.networkError(`Request timeout: ${errorMessage}`);
          }
          continue;
        }

        // Final attempt - return error
        if (retry === this.getMaxRetries() - 1) {
          return ValidationResultFactory.networkError(errorMessage);
        }
      }
    }

    return ValidationResultFactory.networkError('Max retries exceeded');
  }

  /**
   * Clean API key by removing common prefixes
   */
  protected cleanApiKey(apiKey: string): string {
    let key = apiKey.trim();

    // Remove Bearer prefix
    if (key.toLowerCase().startsWith('bearer ')) {
      key = key.slice(7).trim();
    }

    // Remove x-api-key: prefix
    if (key.toLowerCase().startsWith('x-api-key:')) {
      key = key.slice(10).trim();
    }

    return key;
  }

  /**
   * Check if response body contains any quota-related indicators
   */
  protected isQuotaIssue(responseBody: string): boolean {
    return this.containsAny(responseBody, QUOTA_INDICATORS);
  }

  /**
   * Check if response body contains unauthorized indicators
   */
  protected isUnauthorizedResponse(responseBody: string): boolean {
    return this.containsAny(responseBody, UNAUTHORIZED_INDICATORS);
  }

  /**
   * Check if response body contains permission indicators
   */
  protected isPermissionIssue(responseBody: string): boolean {
    return this.containsAny(responseBody, PERMISSION_INDICATORS);
  }

  /**
   * Helper to check if text contains any indicator from a set (case-insensitive)
   */
  protected containsAny(text: string, indicators: Set<string>): boolean {
    const lower = text.toLowerCase();
    for (const indicator of indicators) {
      if (lower.includes(indicator.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Truncate response for logging
   */
  protected truncateResponse(response: string, maxLength: number = 200): string {
    if (!response || response.length <= maxLength) {
      return response || '';
    }
    return response.slice(0, maxLength) + '...';
  }

  /**
   * Mask API key for logging (show first 4 and last 4 chars)
   */
  protected maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length <= 8) {
      return apiKey || '';
    }
    return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  }

  /**
   * Helper to create fetch with timeout
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.getTimeoutMs());

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sleep helper for retry delays
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if HTTP status code indicates success (2xx)
   */
  protected isSuccessStatus(statusCode: number): boolean {
    return statusCode >= 200 && statusCode < 300;
  }

  /**
   * Get detailed information about a key - override in subclasses
   */
  async getKeyDetails(apiKey: string): Promise<KeyDetails> {
    // Default implementation - validate and return basic info
    const validationResult = await this.validateKey(apiKey);

    return {
      status: validationResult.status === ValidationAttemptStatus.Valid ? 'success' : 'error',
      isValid: validationResult.status === ValidationAttemptStatus.Valid,
      hasCredits: validationResult.hasCredits !== false,
      models: validationResult.availableModels || [],
      error: validationResult.status !== ValidationAttemptStatus.Valid
        ? validationResult.detail || 'Validation failed'
        : undefined,
    };
  }

  /**
   * Fetch models list from provider - override in subclasses
   */
  protected async fetchModels(apiKey: string): Promise<ModelInfo[]> {
    return [];
  }

  /**
   * Fetch credit balance from provider - override in subclasses
   */
  protected async fetchCredits(apiKey: string): Promise<{ balance?: number; used?: number } | null> {
    return null;
  }
}
