import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling SendGrid API keys.
 * SendGrid keys provide access to email sending, templates, and analytics.
 */
export class SendGridProvider extends BaseApiKeyProvider {
  readonly providerName = 'SendGrid';
  readonly apiType = ApiTypeEnum.SendGrid;

  readonly regexPatterns = [
    // SendGrid API keys start with SG. followed by base64-like characters
    /\bSG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}\b/,
    // Alternative shorter format
    /\bSG\.[a-zA-Z0-9_-]{20,}\b/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.Communication,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    // SendGrid keys start with "SG." and are typically 69 characters total
    return !!apiKey && apiKey.startsWith('SG.') && apiKey.length >= 50;
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Use SendGrid's user profile endpoint for validation
      const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
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

      if (this.isQuotaIssue(responseBody)) {
        return {
          status: ValidationAttemptStatus.Valid,
          httpStatusCode: response.status,
          hasCredits: false,
          detail: 'SendGrid account may have exceeded quota',
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
