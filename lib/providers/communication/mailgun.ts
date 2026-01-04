import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling Mailgun API keys.
 * Mailgun keys provide access to email sending, routing, and analytics.
 */
export class MailgunProvider extends BaseApiKeyProvider {
  readonly providerName = 'Mailgun';
  readonly apiType = ApiTypeEnum.Mailgun;

  readonly regexPatterns = [
    // Mailgun API keys (start with key-)
    /\bkey-[a-f0-9]{32}\b/,
    // Public validation keys (start with pubkey-)
    /\bpubkey-[a-f0-9]{32}\b/,
    // Newer format keys
    /\b[a-f0-9]{32}-[a-f0-9]{8}-[a-f0-9]{8}\b/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.Communication,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false;

    // API keys start with "key-" followed by 32 hex characters
    if (apiKey.startsWith('key-') && apiKey.length === 36) return true;

    // Public keys start with "pubkey-"
    if (apiKey.startsWith('pubkey-') && apiKey.length === 39) return true;

    return false;
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Use Mailgun's domains endpoint with Basic auth
      // Mailgun uses Basic auth with "api" as username and the API key as password
      const credentials = btoa(`api:${apiKey}`);

      const response = await fetch('https://api.mailgun.net/v3/domains', {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
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
