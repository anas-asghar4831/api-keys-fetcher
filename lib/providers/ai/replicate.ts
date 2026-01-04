import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling Replicate API tokens.
 */
export class ReplicateProvider extends BaseApiKeyProvider {
  readonly providerName = 'Replicate';
  readonly apiType = ApiTypeEnum.Replicate;

  readonly regexPatterns = [
    /r8_[a-zA-Z0-9]{24,}/, // Replicate API tokens start with "r8_"
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    return !!apiKey && apiKey.startsWith('r8_') && apiKey.length >= 27;
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Use Replicate's account endpoint for lightweight authentication check
      // Replicate uses "Token" prefix instead of "Bearer"
      const response = await fetch('https://api.replicate.com/v1/account', {
        method: 'GET',
        headers: {
          Authorization: `Token ${apiKey}`,
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

      // Check for quota/billing/permission issues
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
