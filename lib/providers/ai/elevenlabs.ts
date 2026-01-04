import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling ElevenLabs API keys.
 */
export class ElevenLabsProvider extends BaseApiKeyProvider {
  readonly providerName = 'ElevenLabs';
  readonly apiType = ApiTypeEnum.ElevenLabs;

  readonly regexPatterns = [
    /sk_[a-f0-9]{32}/,
    /xi-api-key:[a-f0-9]{32}/,
    /\b[a-f0-9]{32}\b/, // Only match 32-char hex with word boundaries
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: false,
    verificationDisabledReason: 'Generic 32-char hex pattern matches many non-ElevenLabs strings',
    displayInUI: true,
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected cleanApiKey(apiKey: string): string {
    let key = super.cleanApiKey(apiKey);
    // Clean xi-api-key prefix if present
    if (key.toLowerCase().startsWith('xi-api-key:')) {
      key = key.slice(11).trim();
    }
    return key;
  }

  protected isValidKeyFormat(apiKey: string): boolean {
    let key = apiKey;

    // Clean prefix if present
    if (key.toLowerCase().startsWith('xi-api-key:')) {
      key = key.slice(11).trim();
    } else if (key.startsWith('sk_')) {
      return key.length === 35; // sk_ + 32 hex chars
    }

    // Must be exactly 32 hex characters
    return key.length === 32 && /^[a-f0-9]+$/i.test(key);
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Use ElevenLabs user endpoint for validation
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
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
        return {
          status: ValidationAttemptStatus.Valid,
          httpStatusCode: response.status,
        };
      }

      if (this.isQuotaIssue(responseBody)) {
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
