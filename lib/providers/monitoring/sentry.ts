import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus } from '../types';

// Regex to parse DSN: https://<public_key>@<host>/<project_id>
const DSN_REGEX = /^https:\/\/([a-f0-9]{32})(?::([a-f0-9]{32}))?@([a-z0-9.-]+)\/(\d+)$/i;

/**
 * Provider implementation for handling Sentry DSN and API tokens.
 * Sentry provides error tracking and performance monitoring.
 * DSNs are validated by sending a minimal envelope to the store endpoint.
 */
export class SentryProvider extends BaseApiKeyProvider {
  readonly providerName = 'Sentry';
  readonly apiType = ApiTypeEnum.Sentry;

  readonly regexPatterns = [
    // Sentry DSN format: https://public@sentry.io/project-id
    /https:\/\/[a-f0-9]{32}@[a-z0-9.-]+\.sentry\.io\/[0-9]+/,
    // Sentry DSN with private key
    /https:\/\/[a-f0-9]{32}:[a-f0-9]{32}@[a-z0-9.-]+\.sentry\.io\/[0-9]+/,
    // Sentry API auth tokens
    /\bsntrys_[a-zA-Z0-9]{60,}\b/,
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.Monitoring,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false;

    // Sentry DSN - must match our parsing regex
    if (apiKey.startsWith('https://') && apiKey.includes('sentry.io')) {
      return DSN_REGEX.test(apiKey);
    }

    // Auth tokens (sntrys_ prefix)
    if (apiKey.startsWith('sntrys_') && apiKey.length >= 65) {
      return true;
    }

    return false;
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // If it's a DSN, validate by sending a minimal envelope to the store endpoint
      if (apiKey.startsWith('https://') && apiKey.includes('sentry.io')) {
        return await this.validateDsn(apiKey);
      }

      // For auth tokens, use the API
      if (apiKey.startsWith('sntrys_')) {
        const response = await fetch('https://sentry.io/api/0/', {
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
      }

      return {
        status: ValidationAttemptStatus.HttpError,
        httpStatusCode: 400,
        detail: 'Invalid Sentry credential format',
      };
    } catch (error) {
      return {
        status: ValidationAttemptStatus.NetworkError,
        detail: String(error),
      };
    }
  }

  /**
   * Validates a Sentry DSN by sending a minimal envelope to the store endpoint.
   * Valid DSNs return 200 OK, invalid ones return 401/403.
   */
  private async validateDsn(dsn: string): Promise<ValidationResult> {
    const match = dsn.match(DSN_REGEX);
    if (!match) {
      return {
        status: ValidationAttemptStatus.HttpError,
        httpStatusCode: 400,
        detail: 'Invalid DSN format',
      };
    }

    const publicKey = match[1];
    const host = match[3];
    const projectId = match[4];

    // Sentry store endpoint: https://{host}/api/{project_id}/store/
    const storeUrl = `https://${host}/api/${projectId}/store/`;

    // Create a minimal event with just a valid event_id (32-char hex UUID)
    const eventId = crypto.randomUUID().replace(/-/g, '');
    const payload = JSON.stringify({ event_id: eventId });

    try {
      const response = await fetch(storeUrl, {
        method: 'POST',
        headers: {
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}`,
          'Content-Type': 'application/json',
        },
        body: payload,
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
