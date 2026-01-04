import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling Mapbox API tokens.
 * Mapbox tokens provide access to maps, geocoding, navigation, and location services.
 */
export class MapboxProvider extends BaseApiKeyProvider {
  readonly providerName = 'Mapbox';
  readonly apiType = ApiTypeEnum.Mapbox;

  readonly regexPatterns = [
    // Public tokens (pk.)
    /\bpk\.[a-zA-Z0-9_-]{60,}\b/,
    // Secret tokens (sk.)
    /\bsk\.[a-zA-Z0-9_-]{60,}\b/,
    // Temporary tokens (tk.)
    /\btk\.[a-zA-Z0-9_-]{60,}\b/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.MapsLocation,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false;

    // Mapbox tokens start with pk., sk., or tk. followed by base64-like characters
    return (
      (apiKey.startsWith('pk.') ||
        apiKey.startsWith('sk.') ||
        apiKey.startsWith('tk.')) &&
      apiKey.length >= 80
    );
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Use Mapbox's tokens endpoint for validation
      const response = await fetch(
        `https://api.mapbox.com/tokens/v2?access_token=${encodeURIComponent(apiKey)}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        }
      );

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
