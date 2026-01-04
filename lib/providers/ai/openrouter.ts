import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus, KeyDetails, ModelInfo } from '../types';

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

  /**
   * Get detailed key information including credits and models
   */
  async getKeyDetails(apiKey: string): Promise<KeyDetails> {
    try {
      // Fetch credits
      const creditsResponse = await fetch('https://openrouter.ai/api/v1/credits', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Referer: 'https://unsecuredapikeys.com',
        },
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      });

      if (creditsResponse.status === 401) {
        return {
          status: 'error',
          isValid: false,
          hasCredits: false,
          models: [],
          error: 'Invalid API key',
        };
      }

      let creditBalance: number | undefined;
      let creditUsed: number | undefined;

      if (creditsResponse.ok) {
        try {
          const creditsData: OpenRouterCreditsResponse = await creditsResponse.json();
          if (creditsData?.data) {
            creditBalance = (creditsData.data.total_credits ?? 0) - (creditsData.data.total_usage ?? 0);
            creditUsed = creditsData.data.total_usage;
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Fetch models
      const modelsResponse = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Referer: 'https://unsecuredapikeys.com',
        },
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      });

      let models: ModelInfo[] = [];
      if (modelsResponse.ok) {
        try {
          const modelsData = await modelsResponse.json();
          if (modelsData?.data && Array.isArray(modelsData.data)) {
            // Get top models (free or popular)
            models = modelsData.data
              .slice(0, 50)
              .map((m: { id: string; name?: string; context_length?: number }) => ({
                modelId: m.id,
                displayName: m.name || m.id,
                inputTokenLimit: m.context_length,
              }));
          }
        } catch {
          // Ignore parse errors
        }
      }

      return {
        status: 'success',
        isValid: true,
        hasCredits: (creditBalance ?? 0) > 0,
        creditBalance,
        creditUsed,
        models,
      };
    } catch (error) {
      return {
        status: 'error',
        isValid: false,
        hasCredits: false,
        models: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
