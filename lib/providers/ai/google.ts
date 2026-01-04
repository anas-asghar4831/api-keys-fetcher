import { BaseApiKeyProvider } from '../base-provider';
import { ValidationResultFactory } from '../validation-result';
import {
  ApiTypeEnum,
  ProviderCategory,
  ProviderMetadata,
  ValidationResult,
  ModelInfo,
} from '../types';
import { API_ENDPOINTS } from '@/lib/utils/constants';

/**
 * Google AI (Gemini) API Key Provider
 * Validates keys against /v1beta/models endpoint
 */
export class GoogleProvider extends BaseApiKeyProvider {
  providerName = 'Google';
  apiType = ApiTypeEnum.GoogleAI;

  regexPatterns = [
    /AIza[0-9A-Za-z\-_]{35}/,
    /AIza[0-9A-Za-z\-_]{35,40}/,
  ];

  metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    return apiKey.startsWith('AIza') && apiKey.length >= 39;
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      const response = await this.fetchWithTimeout(API_ENDPOINTS.GOOGLE, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey,
        },
      });

      const body = await response.text();

      // Success - key is valid
      if (this.isSuccessStatus(response.status)) {
        const models = this.parseModels(body);
        return ValidationResultFactory.success(response.status, models, true);
      }

      // Unauthorized / Forbidden
      if (response.status === 401 || response.status === 403) {
        if (this.isUnauthorizedResponse(body)) {
          return ValidationResultFactory.unauthorized(response.status);
        }
        return ValidationResultFactory.unauthorized(response.status);
      }

      // Rate limited
      if (response.status === 429) {
        if (
          body.includes('RESOURCE_EXHAUSTED') ||
          this.isQuotaIssue(body)
        ) {
          return ValidationResultFactory.validNoCredits(
            response.status,
            'Quota exhausted'
          );
        }
        // Rate limited means key is valid
        return ValidationResultFactory.success(response.status, undefined, true);
      }

      // Check for quota issues in any response
      if (
        body.includes('RESOURCE_EXHAUSTED') ||
        this.isQuotaIssue(body)
      ) {
        return ValidationResultFactory.validNoCredits(
          response.status,
          'Quota/billing issue detected'
        );
      }

      return ValidationResultFactory.httpError(
        response.status,
        this.truncateResponse(body)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ValidationResultFactory.networkError(message);
    }
  }

  private parseModels(jsonResponse: string): ModelInfo[] | undefined {
    try {
      const data = JSON.parse(jsonResponse);
      if (!data?.models || !Array.isArray(data.models)) {
        return undefined;
      }

      return data.models.map(
        (model: {
          name: string;
          displayName?: string;
          description?: string;
          version?: string;
          inputTokenLimit?: number;
          outputTokenLimit?: number;
          temperature?: number;
          topP?: number;
          topK?: number;
          maxTemperature?: number;
          supportedGenerationMethods?: string[];
        }) => {
          const modelInfo: ModelInfo = {
            modelId: model.name,
            displayName: model.displayName,
            description: model.description,
            version: model.version,
            inputTokenLimit: model.inputTokenLimit,
            outputTokenLimit: model.outputTokenLimit,
          };

          // Parse supported methods
          if (model.supportedGenerationMethods) {
            modelInfo.supportedMethods = model.supportedGenerationMethods;
          }

          // Determine model group from display name
          if (model.displayName?.includes('Gemini')) {
            const parts = model.displayName.split(' ');
            if (parts.length >= 2) {
              modelInfo.modelGroup = `${parts[0]} ${parts[1]}`;
            }
          }

          return modelInfo;
        }
      );
    } catch {
      return undefined;
    }
  }
}
