import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling AI21 Labs API keys.
 * DISABLED: AI21 uses Cloudflare protection that rate-limits by IP (not API key).
 * All requests return 429 before the API validates the key, causing false positives.
 */
export class AI21Provider extends BaseApiKeyProvider {
  readonly providerName = 'AI21';
  readonly apiType = ApiTypeEnum.AI21;

  // AI21 keys have no unique prefix - pattern disabled to prevent false positives
  readonly regexPatterns: RegExp[] = [];

  readonly metadata: ProviderMetadata = {
    scraperUse: false,
    scraperDisabledReason: 'AI21 keys have no unique prefix',
    verificationUse: false,
    verificationDisabledReason: 'Cloudflare IP-based rate limiting prevents validation',
    displayInUI: false,
    hiddenFromUIReason: 'Cloudflare protection causes false positives',
    category: ProviderCategory.AI_LLM,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(_apiKey: string): boolean {
    // AI21 keys have no unique identifier - cannot reliably validate format
    return false;
  }

  protected async validateKeyWithHttp(_apiKey: string): Promise<ValidationResult> {
    // AI21 uses Cloudflare which rate-limits by IP, not by API key
    return {
      status: ValidationAttemptStatus.Unknown,
      detail: 'Cloudflare IP-based rate limiting prevents validation',
    };
  }
}
