import { BaseApiKeyProvider } from '../base-provider';
import { ValidationResultFactory } from '../validation-result';
import {
  ApiTypeEnum,
  ProviderCategory,
  ProviderMetadata,
  ValidationResult,
  ModelInfo,
} from '../types';
import { API_ENDPOINTS } from '@/lib/utils/constants';

/**
 * GitHub API Token Provider
 * Validates tokens against /user endpoint
 */
export class GitHubProvider extends BaseApiKeyProvider {
  providerName = 'GitHub';
  apiType = ApiTypeEnum.GitHub;

  regexPatterns = [
    /ghp_[A-Za-z0-9]{36}/, // Classic Personal Access Token
    /github_pat_[A-Za-z0-9_]{22,82}/, // Fine-grained Personal Access Token
    /gho_[A-Za-z0-9]{36}/, // OAuth token
    /ghs_[A-Za-z0-9]{36}/, // Server-to-server token
    /ghr_[A-Za-z0-9]{36}/, // Refresh token
  ];

  metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: false,
    hiddenFromUIReason: 'Source control tokens not publicly displayed',
    category: ProviderCategory.SourceControl,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey || apiKey.length < 20) return false;

    return (
      apiKey.startsWith('ghp_') ||
      apiKey.startsWith('github_pat_') ||
      apiKey.startsWith('gho_') ||
      apiKey.startsWith('ghs_') ||
      apiKey.startsWith('ghr_')
    );
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      const response = await this.fetchWithTimeout(API_ENDPOINTS.GITHUB, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'UnsecuredAPIKeys-Verifier/1.0',
          Accept: 'application/vnd.github+json',
        },
      });

      const body = await response.text();

      // Success - key is valid
      if (this.isSuccessStatus(response.status)) {
        const metadata = this.extractMetadata(response, body);
        return ValidationResultFactory.success(response.status, metadata, true);
      }

      // Unauthorized
      if (response.status === 401) {
        return ValidationResultFactory.unauthorized(response.status);
      }

      // Forbidden - check rate limit
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        if (rateLimitRemaining === '0') {
          return ValidationResultFactory.validNoCredits(
            response.status,
            'Rate limit exceeded'
          );
        }
        if (body.includes('API rate limit exceeded')) {
          return ValidationResultFactory.validNoCredits(
            response.status,
            'API rate limit exceeded'
          );
        }
        return ValidationResultFactory.unauthorized(response.status);
      }

      // Not found - token valid but lacks user scope
      if (response.status === 404) {
        return ValidationResultFactory.success(response.status, undefined, true);
      }

      // Rate limited
      if (response.status === 429) {
        return ValidationResultFactory.validNoCredits(response.status, 'Rate limited');
      }

      return ValidationResultFactory.httpError(
        response.status,
        this.truncateResponse(body)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ValidationResultFactory.networkError(message);
    }
  }

  private extractMetadata(response: Response, responseBody: string): ModelInfo[] | undefined {
    const metadata: ModelInfo[] = [];

    try {
      // Extract scopes from header
      const scopes = response.headers.get('X-OAuth-Scopes');
      if (scopes) {
        metadata.push({
          modelId: 'scopes',
          displayName: 'OAuth Scopes',
          description: scopes,
        });
      }

      // Extract rate limit info
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      if (rateLimitRemaining) {
        metadata.push({
          modelId: 'rate_limit',
          displayName: 'Rate Limit Remaining',
          description: rateLimitRemaining,
        });
      }

      // Parse user info from response body
      const data = JSON.parse(responseBody);

      if (data.login) {
        metadata.push({
          modelId: 'username',
          displayName: 'Username',
          description: data.login,
        });
      }

      if (data.type) {
        metadata.push({
          modelId: 'account_type',
          displayName: 'Account Type',
          description: data.type,
        });
      }

      if (data.plan?.name) {
        metadata.push({
          modelId: 'plan',
          displayName: 'Plan',
          description: data.plan.name,
        });
      }
    } catch {
      // Ignore parsing errors
    }

    return metadata.length > 0 ? metadata : undefined;
  }
}
