import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling Datadog API keys.
 * DEPRECATED: Datadog keys are generic 32/40 hex characters with no unique prefix.
 * These patterns match many other key types (SHA hashes, other hex tokens).
 * Too many false positives to reliably validate.
 */
export class DatadogProvider extends BaseApiKeyProvider {
  readonly providerName = 'Datadog';
  readonly apiType = ApiTypeEnum.Datadog;

  readonly regexPatterns = [
    // Datadog API keys (32 hex characters)
    /\b[a-f0-9]{32}\b/,
    // Application keys (40 hex characters)
    /\b[a-f0-9]{40}\b/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: false,
    scraperDisabledReason: 'Generic hex patterns match too many false positives',
    verificationUse: false,
    verificationDisabledReason: 'Generic 32/40-char hex patterns are not unique to Datadog',
    displayInUI: false,
    hiddenFromUIReason: 'Cannot reliably identify Datadog keys from generic hex strings',
    category: ProviderCategory.Monitoring,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false;

    // Datadog API keys are 32 hex characters
    // Application keys are 40 hex characters
    if (apiKey.length !== 32 && apiKey.length !== 40) return false;

    return /^[a-f0-9]+$/.test(apiKey);
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Use Datadog's validate endpoint
      const response = await fetch('https://api.datadoghq.com/api/v1/validate', {
        method: 'GET',
        headers: {
          'DD-API-KEY': apiKey,
        },
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      });

      const responseBody = await response.text();

      if (response.ok) {
        if (
          responseBody.includes('"valid":true') ||
          responseBody.includes('"valid": true')
        ) {
          return {
            status: ValidationAttemptStatus.Valid,
            httpStatusCode: response.status,
          };
        }
        return {
          status: ValidationAttemptStatus.Valid,
          httpStatusCode: response.status,
        };
      }

      if (response.status === 401 || response.status === 403) {
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
