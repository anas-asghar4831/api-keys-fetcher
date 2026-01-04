import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling Anyscale API keys.
 */
export class AnyscaleProvider extends BaseApiKeyProvider {
  readonly providerName = 'Anyscale';
  readonly apiType = ApiTypeEnum.Anyscale;

  readonly regexPatterns = [
    /esecret_[a-zA-Z0-9]{20,80}/,
    /anyscale[_-]?[a-zA-Z0-9]{20,80}/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    return !!apiKey && apiKey.length >= 20 && apiKey.startsWith('esecret_');
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Anyscale uses OpenAI-compatible API
      const response = await fetch('https://api.endpoints.anyscale.com/v1/models', {
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

      if (response.status === 402 || this.isQuotaIssue(responseBody)) {
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
