import { BaseApiKeyProvider } from '../base-provider';
import { ValidationResultFactory } from '../validation-result';
import {
  ApiTypeEnum,
  ProviderCategory,
  ProviderMetadata,
  ValidationResult,
} from '../types';
import { API_ENDPOINTS } from '@/lib/utils/constants';

// Anthropic API version header
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * Anthropic (Claude) API Key Provider
 * Validates keys by sending minimal message request
 */
export class AnthropicProvider extends BaseApiKeyProvider {
  providerName = 'Anthropic';
  apiType = ApiTypeEnum.AnthropicClaude;

  regexPatterns = [
    /sk-ant-api\d{0,2}-[a-zA-Z0-9\-_]{40,120}/,
    /sk-ant-[a-zA-Z0-9\-_]{40,95}/,
    /sk-ant-v\d+-[a-zA-Z0-9\-_]{40,95}/,
    /sk-ant-[a-zA-Z0-9]+-[a-zA-Z0-9\-_]{20,120}/,
    /sk-ant-[a-zA-Z0-9]{40,64}/,
    /\bsk-ant-[a-zA-Z0-9\-_]{20,120}\b/,
  ];

  metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey || apiKey.length < 20) return false;
    if (!apiKey.startsWith('sk-ant-')) return false;
    // Check all characters are valid
    return /^[a-zA-Z0-9\-_]+$/.test(apiKey);
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Create minimal payload for lowest cost validation
      const payload = {
        model: DEFAULT_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: '1' }],
        temperature: 0,
        stop_sequences: ['1', '2', '3', '4', '5'],
      };

      const response = await this.fetchWithTimeout(API_ENDPOINTS.ANTHROPIC, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.text();
      return this.interpretResponse(response.status, body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ValidationResultFactory.networkError(message);
    }
  }

  private interpretResponse(
    statusCode: number,
    responseBody: string
  ): ValidationResult {
    const bodyLower = responseBody.toLowerCase();

    // Success - key is valid
    if (this.isSuccessStatus(statusCode)) {
      return ValidationResultFactory.success(statusCode, undefined, true);
    }

    // Unauthorized - invalid key
    if (statusCode === 401) {
      return ValidationResultFactory.unauthorized(statusCode);
    }

    // Forbidden - check if permission issue (key might still be valid)
    if (statusCode === 403) {
      if (this.isPermissionIssue(bodyLower)) {
        // Permission denied but key is valid
        return ValidationResultFactory.success(statusCode, undefined, true);
      }
      return ValidationResultFactory.httpError(
        statusCode,
        `Forbidden: ${this.truncateResponse(responseBody)}`
      );
    }

    // Bad request - check for quota issues
    if (statusCode === 400) {
      if (this.isQuotaIssue(bodyLower)) {
        return ValidationResultFactory.validNoCredits(
          statusCode,
          'Quota/billing issue detected'
        );
      }
      return ValidationResultFactory.httpError(
        statusCode,
        `Bad request: ${this.truncateResponse(responseBody)}`
      );
    }

    // Payment required
    if (statusCode === 402) {
      return ValidationResultFactory.validNoCredits(statusCode, 'Payment required');
    }

    // Rate limited
    if (statusCode === 429) {
      if (this.isQuotaIssue(bodyLower)) {
        return ValidationResultFactory.validNoCredits(statusCode, 'Quota exhausted');
      }
      // Rate limited means key is valid
      return ValidationResultFactory.success(statusCode, undefined, true);
    }

    // Service unavailable / Gateway timeout
    if (statusCode === 503 || statusCode === 504) {
      return ValidationResultFactory.networkError(`Service unavailable: ${statusCode}`);
    }

    // Other errors - check for quota indicators
    if (this.isQuotaIssue(bodyLower)) {
      return ValidationResultFactory.validNoCredits(
        statusCode,
        'Quota issue detected'
      );
    }

    return ValidationResultFactory.httpError(
      statusCode,
      `API request failed: ${this.truncateResponse(responseBody)}`
    );
  }
}
