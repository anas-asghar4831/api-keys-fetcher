import { BaseApiKeyProvider } from '../base-provider';
import { ValidationResultFactory } from '../validation-result';
import {
  ApiTypeEnum,
  ProviderCategory,
  ProviderMetadata,
  ValidationResult,
} from '../types';

/**
 * AWS Bedrock Provider
 *
 * DISABLED: AWS access keys require:
 * 1. Access Key ID (AKIA/ASIA prefix)
 * 2. Secret Access Key (paired with the ID)
 * 3. AWS Region
 * 4. SigV4 signing for requests
 *
 * We can only scrape the Access Key ID, not the full credential set.
 */
export class AWSBedrockProvider extends BaseApiKeyProvider {
  providerName = 'AWS Bedrock';
  apiType = ApiTypeEnum.AWSBedrock;

  regexPatterns = [
    /AKIA[0-9A-Z]{16}/, // AWS Access Key ID (long-term)
    /ASIA[0-9A-Z]{16}/, // AWS Session-based Access Key ID
    /AIDA[0-9A-Z]{16}/, // AWS IAM User ID (not an access key, but often confused)
  ];

  metadata: ProviderMetadata = {
    scraperUse: false,
    scraperDisabledReason: 'Access Key IDs are only half of AWS credentials; Secret Key required',
    verificationUse: false,
    verificationDisabledReason: 'Requires paired Secret Access Key + Region + SigV4 signing',
    displayInUI: false,
    hiddenFromUIReason: 'Cannot verify without complete credential set',
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    // AWS Access Key IDs are exactly 20 characters
    if (apiKey.length !== 20) return false;

    // Must start with AKIA, ASIA, or AIDA
    const prefix = apiKey.substring(0, 4);
    if (!['AKIA', 'ASIA', 'AIDA'].includes(prefix)) return false;

    // Remaining 16 chars must be alphanumeric uppercase
    return /^[0-9A-Z]+$/.test(apiKey.substring(4));
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    // Cannot validate without the secret key and region
    return ValidationResultFactory.providerError(
      'AWS Bedrock requires Secret Access Key and Region for validation'
    );
  }
}
