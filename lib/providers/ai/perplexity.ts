import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling Perplexity AI API keys.
 */
export class PerplexityProvider extends BaseApiKeyProvider {
  readonly providerName = 'Perplexity AI';
  readonly apiType = ApiTypeEnum.PerplexityAI;

  readonly regexPatterns = [
    /pplx-[a-zA-Z0-9]{48,56}/,
    /pplx-[a-f0-9]{48}/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    return !!apiKey && apiKey.length >= 20 && apiKey.startsWith('pplx-');
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      const response = await fetch('https://api.perplexity.ai/models', {
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
