import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling Supabase API keys.
 * DEPRECATED: Supabase keys are JWTs that require the project URL for validation.
 * Cannot validate keys without knowing which Supabase project they belong to.
 * Keys are scraped but not verified.
 */
export class SupabaseProvider extends BaseApiKeyProvider {
  readonly providerName = 'Supabase';
  readonly apiType = ApiTypeEnum.Supabase;

  readonly regexPatterns = [
    // Service role keys with sbp_ prefix (more specific)
    /\bsbp_[a-f0-9]{40}\b/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: false,
    verificationDisabledReason: 'Requires project URL to validate (JWTs are project-specific)',
    displayInUI: false,
    hiddenFromUIReason: 'Cannot verify without Supabase project URL',
    category: ProviderCategory.DatabaseBackend,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false;

    // Service role key format with prefix
    if (apiKey.startsWith('sbp_')) {
      return apiKey.length >= 44;
    }

    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async validateKeyWithHttp(_apiKey: string): Promise<ValidationResult> {
    // Supabase keys are JWTs - full validation requires knowing the project URL
    return {
      status: ValidationAttemptStatus.Unknown,
      detail: 'Cannot validate without Supabase project URL',
    };
  }
}
