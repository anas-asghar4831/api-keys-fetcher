import { BaseApiKeyProvider } from '../base-provider';
import { ValidationResultFactory } from '../validation-result';
import {
  ApiTypeEnum,
  ProviderCategory,
  ProviderMetadata,
  ValidationResult,
  ModelInfo,
  KeyDetails,
} from '../types';
import { API_ENDPOINTS } from '@/lib/utils/constants';

/**
 * OpenAI API Key Provider
 * Validates keys against /v1/models endpoint
 */
export class OpenAIProvider extends BaseApiKeyProvider {
  providerName = 'OpenAI';
  apiType = ApiTypeEnum.OpenAI;

  regexPatterns = [
    /sk-[A-Za-z0-9\-]{20,}/,
    /sk-proj-[A-Za-z0-9\-]{20,}/,
    /sk-svcacct-[A-Za-z0-9\-]{20,}/,
    /sk-[A-Za-z0-9]{48}/,
    /Bearer sk-[A-Za-z0-9\-]{20,}/,
  ];

  metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    return apiKey.startsWith('sk-') && apiKey.length >= 23;
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      const response = await this.fetchWithTimeout(API_ENDPOINTS.OPENAI, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const body = await response.text();

      // Success - key is valid
      if (this.isSuccessStatus(response.status)) {
        const models = this.parseModels(body);
        return ValidationResultFactory.success(response.status, models, true);
      }

      // Unauthorized - invalid key
      if (response.status === 401) {
        return ValidationResultFactory.unauthorized(response.status);
      }

      // Rate limited - key is valid but throttled
      if (response.status === 429) {
        if (body.includes('insufficient_quota')) {
          return ValidationResultFactory.validNoCredits(
            response.status,
            'Quota exceeded'
          );
        }
        // Rate limited means key works
        return ValidationResultFactory.success(response.status);
      }

      // Payment required - valid but no credits
      if (response.status === 402) {
        return ValidationResultFactory.validNoCredits(
          response.status,
          'Payment required'
        );
      }

      // Check for quota indicators in response body
      if (this.isQuotaIssue(body)) {
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
      if (!data?.data || !Array.isArray(data.data)) {
        return undefined;
      }

      return data.data.map((model: { id: string; owned_by?: string }) => {
        const modelInfo: ModelInfo = {
          modelId: model.id,
          displayName: model.id,
        };

        // Group models by type
        if (model.id.startsWith('gpt-4')) {
          modelInfo.modelGroup = 'GPT-4';
          if (model.id.includes('turbo')) {
            modelInfo.description = 'GPT-4 Turbo model';
          } else if (model.id.includes('vision')) {
            modelInfo.description = 'GPT-4 with vision capabilities';
          }
        } else if (model.id.startsWith('gpt-3.5')) {
          modelInfo.modelGroup = 'GPT-3.5';
        } else if (model.id.startsWith('o1')) {
          modelInfo.modelGroup = 'O1';
          modelInfo.description = 'Reasoning model';
        } else if (model.id.startsWith('text-embedding')) {
          modelInfo.modelGroup = 'Embeddings';
        } else if (model.id.startsWith('dall-e')) {
          modelInfo.modelGroup = 'DALL-E';
        } else if (model.id.startsWith('whisper')) {
          modelInfo.modelGroup = 'Whisper';
        } else if (model.id.startsWith('tts')) {
          modelInfo.modelGroup = 'TTS';
        } else {
          modelInfo.modelGroup = 'Other';
        }

        return modelInfo;
      });
    } catch {
      return undefined;
    }
  }

  /**
   * Get detailed key information including models
   */
  async getKeyDetails(apiKey: string): Promise<KeyDetails> {
    try {
      const response = await this.fetchWithTimeout(API_ENDPOINTS.OPENAI, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const body = await response.text();

      if (response.status === 401) {
        return {
          status: 'error',
          isValid: false,
          hasCredits: false,
          models: [],
          error: 'Invalid API key',
        };
      }

      if (response.status === 429) {
        const isQuota = body.includes('insufficient_quota');
        return {
          status: 'success',
          isValid: true,
          hasCredits: !isQuota,
          models: [],
          error: isQuota ? 'Quota exceeded' : 'Rate limited',
        };
      }

      if (this.isSuccessStatus(response.status)) {
        const models = this.parseModels(body) || [];
        // Filter to show only important models
        const importantModels = models.filter(m =>
          m.modelId.startsWith('gpt-') ||
          m.modelId.startsWith('o1') ||
          m.modelId.startsWith('o3') ||
          m.modelId.startsWith('dall-e') ||
          m.modelId.startsWith('whisper') ||
          m.modelId.startsWith('tts')
        );

        return {
          status: 'success',
          isValid: true,
          hasCredits: true,
          models: importantModels,
        };
      }

      return {
        status: 'error',
        isValid: false,
        hasCredits: false,
        models: [],
        error: `HTTP ${response.status}: ${this.truncateResponse(body)}`,
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
