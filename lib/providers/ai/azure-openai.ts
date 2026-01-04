import { BaseApiKeyProvider } from '../base-provider';
import { ValidationResultFactory } from '../validation-result';
import {
  ApiTypeEnum,
  ProviderCategory,
  ProviderMetadata,
  ValidationResult,
} from '../types';

/**
 * Azure OpenAI API Key Provider
 *
 * DISABLED: Azure OpenAI keys require a resource endpoint URL
 * (e.g., https://{resource}.openai.azure.com/) which is not included with the key.
 * Keys are 32-character hex strings which are too generic to reliably scrape.
 */
export class AzureOpenAIProvider extends BaseApiKeyProvider {
  providerName = 'Azure OpenAI';
  apiType = ApiTypeEnum.AzureOpenAI;

  regexPatterns = [
    /[a-fA-F0-9]{32}/, // Generic 32-char hex
  ];

  metadata: ProviderMetadata = {
    scraperUse: false,
    scraperDisabledReason: 'Generic 32-char hex pattern matches many non-Azure strings',
    verificationUse: false,
    verificationDisabledReason: 'Requires Azure resource endpoint URL which is not included with key',
    displayInUI: false,
    hiddenFromUIReason: 'Cannot verify without resource endpoint',
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    // Must be exactly 32 hex characters
    return apiKey.length === 32 && /^[a-fA-F0-9]+$/.test(apiKey);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async validateKeyWithHttp(_apiKey: string): Promise<ValidationResult> {
    // Cannot validate without knowing the Azure resource endpoint
    return ValidationResultFactory.providerError(
      'Azure OpenAI requires resource endpoint URL for validation'
    );
  }
}
