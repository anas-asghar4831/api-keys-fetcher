import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling DigitalOcean API tokens.
 * DigitalOcean tokens provide access to cloud infrastructure including droplets, databases, and storage.
 */
export class DigitalOceanProvider extends BaseApiKeyProvider {
  readonly providerName = 'DigitalOcean';
  readonly apiType = ApiTypeEnum.DigitalOcean;

  readonly regexPatterns = [
    // Personal access tokens (v1) - modern format with prefix
    /\bdop_v1_[a-f0-9]{64}\b/,
    // OAuth tokens - modern format with prefix
    /\bdoo_v1_[a-f0-9]{64}\b/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.CloudInfrastructure,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false;

    // Only accept tokens with DigitalOcean prefixes
    if (apiKey.startsWith('dop_v1_') || apiKey.startsWith('doo_v1_')) {
      // prefix (7) + 64 hex chars = 71 total
      if (apiKey.length < 71) return false;

      // Verify the hex portion after prefix
      const hexPart = apiKey.slice(7);
      return hexPart.length === 64 && /^[a-f0-9]+$/i.test(hexPart);
    }

    return false;
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Use DigitalOcean's account endpoint for validation (lightweight check)
      const response = await fetch('https://api.digitalocean.com/v2/account', {
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
