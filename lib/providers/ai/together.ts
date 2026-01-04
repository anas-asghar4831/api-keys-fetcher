import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling Together AI API tokens.
 */
export class TogetherProvider extends BaseApiKeyProvider {
  readonly providerName = 'Together AI';
  readonly apiType = ApiTypeEnum.TogetherAI;

  readonly regexPatterns = [
    /tok_[a-zA-Z0-9]{32,}/, // Together AI tokens start with "tok_"
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: false, // Disabled in original
    displayInUI: true,
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    return !!apiKey && apiKey.startsWith('tok_') && apiKey.length >= 36;
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      const response = await fetch('https://api.together.xyz/models', {
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
