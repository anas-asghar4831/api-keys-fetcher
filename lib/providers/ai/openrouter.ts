import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

interface OpenRouterCreditsResponse {
  data?: {
    total_credits?: number;
    total_usage?: number;
  };
}

/**
 * Provider implementation for handling OpenRouter API keys.
 */
export class OpenRouterProvider extends BaseApiKeyProvider {
  readonly providerName = 'OpenRouter';
  readonly apiType = ApiTypeEnum.OpenRouter;

  readonly regexPatterns = [
    /sk-or-[a-zA-Z0-9]{24,48}/,
    /sk-or-v1-[a-zA-Z0-9]{48,64}/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    return !!apiKey && apiKey.startsWith('sk-or-') && apiKey.length >= 30;
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Use the lightweight credits endpoint for validation
      const response = await fetch('https://openrouter.ai/api/v1/credits', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Referer: 'https://unsecuredapikeys.com',
        },
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      });

      const responseBody = await response.text();

      if (response.ok) {
        try {
          const creditsData: OpenRouterCreditsResponse = JSON.parse(responseBody);

          if (creditsData?.data) {
            const totalCredits = creditsData.data.total_credits ?? 0;
            const totalUsage = creditsData.data.total_usage ?? 0;
            const remainingCredits = totalCredits - totalUsage;
            const hasCredits = remainingCredits > 0;

            return {
              status: ValidationAttemptStatus.Valid,
              httpStatusCode: response.status,
              hasCredits,
              creditBalance: remainingCredits,
            };
          }

          return {
            status: ValidationAttemptStatus.Valid,
            httpStatusCode: response.status,
          };
        } catch {
          // If response is successful but unparseable, still consider key valid
          return {
            status: ValidationAttemptStatus.Valid,
            httpStatusCode: response.status,
          };
        }
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

      // Check for quota/billing/permission issues
      if (
        this.isQuotaIssue(responseBody) ||
        responseBody.toLowerCase().includes('rate_limit_exceeded') ||
        responseBody.toLowerCase().includes('moderation')
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
