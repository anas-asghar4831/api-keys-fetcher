import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling Twilio API keys.
 * DEPRECATED: Twilio requires Account SID + Auth Token pair for authentication.
 * Cannot validate individual credentials without the paired component.
 * Account SIDs, Auth Tokens, and API Key SIDs are scraped but not verified.
 */
export class TwilioProvider extends BaseApiKeyProvider {
  readonly providerName = 'Twilio';
  readonly apiType = ApiTypeEnum.Twilio;

  readonly regexPatterns = [
    // Twilio Account SID (starts with AC)
    /\bAC[a-f0-9]{32}\b/,
    // API Key SID (starts with SK)
    /\bSK[a-f0-9]{32}\b/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: false,
    verificationDisabledReason: 'Requires Account SID + Auth Token pair for authentication',
    displayInUI: false,
    hiddenFromUIReason: 'Cannot verify without paired credentials',
    category: ProviderCategory.Communication,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false;

    // Account SID: AC + 32 hex chars
    if (apiKey.startsWith('AC') && apiKey.length === 34) {
      return /^[a-f0-9]+$/i.test(apiKey.slice(2));
    }

    // API Key SID: SK + 32 hex chars
    if (apiKey.startsWith('SK') && apiKey.length === 34) {
      return /^[a-f0-9]+$/i.test(apiKey.slice(2));
    }

    return false;
  }

  protected async validateKeyWithHttp(_apiKey: string): Promise<ValidationResult> {
    // Twilio requires Account SID + Auth Token for Basic auth
    return {
      status: ValidationAttemptStatus.Unknown,
      detail: 'Cannot validate without paired Account SID/Auth Token',
    };
  }
}
