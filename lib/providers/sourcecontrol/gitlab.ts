import { BaseApiKeyProvider } from '../base-provider';
import { ApiTypeEnum, ProviderCategory, ProviderMetadata, ValidationResult, ValidationAttemptStatus, ModelInfo } from '../types';

/**
 * Provider implementation for validating GitLab Personal Access Tokens (PATs).
 * Supports tokens with the glpat- prefix.
 */
export class GitLabProvider extends BaseApiKeyProvider {
  readonly providerName = 'GitLab';
  readonly apiType = ApiTypeEnum.GitLab;

  readonly regexPatterns = [
    /glpat-[A-Za-z0-9\-_]{20,}/, // Personal Access Token
  ];

  readonly metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: false,
    hiddenFromUIReason: 'Source control tokens not publicly displayed',
    category: ProviderCategory.SourceControl,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    return !!apiKey && apiKey.length >= 25 && apiKey.startsWith('glpat-');
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      // GitLab uses PRIVATE-TOKEN header for authentication
      const response = await fetch('https://gitlab.com/api/v4/user', {
        method: 'GET',
        headers: {
          'PRIVATE-TOKEN': apiKey,
        },
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      });

      const responseBody = await response.text();

      if (response.ok) {
        const metadata = this.extractMetadata(responseBody);
        return {
          status: ValidationAttemptStatus.Valid,
          httpStatusCode: response.status,
          hasCredits: true,
          availableModels: metadata,
        };
      }

      if (response.status === 401) {
        return {
          status: ValidationAttemptStatus.Unauthorized,
          httpStatusCode: response.status,
        };
      }

      if (response.status === 403) {
        // Token valid but insufficient scopes
        return {
          status: ValidationAttemptStatus.Valid,
          httpStatusCode: response.status,
          hasCredits: true,
        };
      }

      if (response.status === 429) {
        return {
          status: ValidationAttemptStatus.Valid,
          httpStatusCode: response.status,
          hasCredits: false,
          detail: 'Rate limited',
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

  private extractMetadata(responseBody: string): ModelInfo[] | undefined {
    const metadata: ModelInfo[] = [];

    try {
      const data = JSON.parse(responseBody);

      if (data.username) {
        metadata.push({
          modelId: 'username',
          displayName: 'Username',
          description: data.username,
        });
      }

      if (data.name) {
        metadata.push({
          modelId: 'name',
          displayName: 'Display Name',
          description: data.name,
        });
      }

      if (typeof data.is_admin === 'boolean') {
        metadata.push({
          modelId: 'is_admin',
          displayName: 'Admin',
          description: data.is_admin ? 'Yes' : 'No',
        });
      }

      if (typeof data.can_create_group === 'boolean') {
        metadata.push({
          modelId: 'can_create_group',
          displayName: 'Can Create Group',
          description: data.can_create_group ? 'Yes' : 'No',
        });
      }

      if (typeof data.can_create_project === 'boolean') {
        metadata.push({
          modelId: 'can_create_project',
          displayName: 'Can Create Project',
          description: data.can_create_project ? 'Yes' : 'No',
        });
      }

      if (typeof data.two_factor_enabled === 'boolean') {
        metadata.push({
          modelId: 'two_factor_enabled',
          displayName: '2FA Enabled',
          description: data.two_factor_enabled ? 'Yes' : 'No',
        });
      }
    } catch {
      // Ignore parsing errors
    }

    return metadata.length > 0 ? metadata : undefined;
  }
}
