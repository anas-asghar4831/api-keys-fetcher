import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

/**
 * Provider implementation for handling Discord Bot tokens.
 * Discord bot tokens provide access to Discord servers, channels, and user data.
 */
export class DiscordProvider extends BaseApiKeyProvider {
  readonly providerName = 'Discord Bot';
  readonly apiType = ApiTypeEnum.Discord;

  readonly regexPatterns = [
    // Discord bot tokens are base64 encoded and typically have this structure:
    // [Bot ID base64].[Timestamp base64].[HMAC base64]
    /\b[MN][A-Za-z0-9]{23,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}\b/,
    // Alternative pattern for newer tokens
    /\b[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,38}\b/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.Communication,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false;

    // Discord tokens have a specific structure with dots separating parts
    const parts = apiKey.split('.');
    if (parts.length !== 3) return false;

    // Total length is typically 59-72 characters
    return apiKey.length >= 50 && apiKey.length <= 80;
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // Use Discord's users/@me endpoint for validation
      const response = await fetch('https://discord.com/api/v10/users/@me', {
        method: 'GET',
        headers: {
          Authorization: `Bot ${apiKey}`,
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
