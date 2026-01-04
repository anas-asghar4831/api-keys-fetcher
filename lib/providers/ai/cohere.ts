import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling Cohere API keys.
 */
export class CohereProvider extends BaseApiKeyProvider {
  readonly providerName = 'Cohere';
  readonly apiType = ApiTypeEnum.Cohere;

  readonly regexPatterns = [
    /co-[a-zA-Z0-9]{32}/, // Newer format Cohere keys (preferred)
    /\bco[a-zA-Z0-9]{38}\b/, // Legacy format with word boundaries
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false;

    // Prefer the newer co- format, but allow the older 40-char format
    if (apiKey.startsWith('co-') && apiKey.length >= 35) {
      return true;
    }

    // Legacy 40 character alphanumeric format
    if (apiKey.length === 40 && /^[a-zA-Z0-9]+$/.test(apiKey)) {
      return true;
    }

    return false;
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      const response = await fetch('https://api.cohere.ai/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      });

      const responseBody = await response.text();

      if (response.ok) {
        return {
          status: ValidationAttemptStatus.Valid,
          httpStatusCode: response.status,
        };
      }

      if (response.status === 401) {
        return {
          status: ValidationAttemptStatus.Unauthorized,
          httpStatusCode: response.status,
        };
      }

      if (response.status === 429) {
        // Rate limited means the key is valid
        return {
          status: ValidationAttemptStatus.Valid,
          httpStatusCode: response.status,
        };
      }

      // Check for quota/billing/permission issues specific to Cohere
      if (
        this.isQuotaIssue(responseBody) ||
        responseBody.toLowerCase().includes('blocklist') ||
        responseBody.toLowerCase().includes('finetuning_access_only')
      ) {
        return {
          status: ValidationAttemptStatus.Valid,
          httpStatusCode: response.status,
          hasCredits: false,
        };
      }

      return {
        status: ValidationAttemptStatus.HttpError,
        httpStatusCode: response.status,
        detail: responseBody.slice(0, 200),
      };
    } catch (error) {
      return {
        status: ValidationAttemptStatus.NetworkError,
        detail: String(error),
      };
    }
  }
}
