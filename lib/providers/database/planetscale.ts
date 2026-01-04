import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling PlanetScale API tokens.
 * PlanetScale tokens provide access to serverless MySQL databases.
 */
export class PlanetScaleProvider extends BaseApiKeyProvider {
  readonly providerName = 'PlanetScale';
  readonly apiType = ApiTypeEnum.PlanetScale;

  readonly regexPatterns = [
    // PlanetScale service tokens
    /\bpscale_tkn_[a-zA-Z0-9_]{30,}\b/,
    // PlanetScale OAuth tokens
    /\bpscale_oauth_[a-zA-Z0-9_]{30,}\b/,
    // Database connection passwords
    /\bpscale_pw_[a-zA-Z0-9_]{30,}\b/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.DatabaseBackend,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false;

    // PlanetScale tokens start with pscale_ prefix
    return (
      apiKey.startsWith('pscale_tkn_') ||
      apiKey.startsWith('pscale_oauth_') ||
      apiKey.startsWith('pscale_pw_')
    );
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Use PlanetScale's organizations endpoint for validation
      const response = await fetch('https://api.planetscale.com/v1/organizations', {
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

      if (response.status === 401 || response.status === 403) {
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
