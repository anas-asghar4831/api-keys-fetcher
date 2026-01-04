import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling Cloudflare API tokens.
 * Cloudflare tokens provide access to DNS, CDN, security, and worker services.
 */
export class CloudflareProvider extends BaseApiKeyProvider {
  readonly providerName = 'Cloudflare';
  readonly apiType = ApiTypeEnum.Cloudflare;

  readonly regexPatterns = [
    // Only scrape tokens with explicit Cloudflare prefix
    /\bcf_[A-Za-z0-9_-]{37,}\b/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.CloudInfrastructure,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    // Only accept tokens with Cloudflare prefix
    return !!apiKey && apiKey.startsWith('cf_') && apiKey.length >= 40;
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Use Cloudflare's token verification endpoint
      const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      });

      const responseBody = await response.text();

      if (response.ok) {
        // Check if the response indicates a valid token
        if (
          responseBody.includes('"status":"active"') ||
          responseBody.includes('"success":true')
        ) {
          return {
            status: ValidationAttemptStatus.Valid,
            httpStatusCode: response.status,
          };
        }
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
