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
 * Slack API Token Provider
 * Validates tokens against auth.test endpoint
 * Note: Slack always returns 200, validity is in response body
 */
export class SlackProvider extends BaseApiKeyProvider {
  providerName = 'Slack';
  apiType = ApiTypeEnum.Slack;

  regexPatterns = [
    /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/, // Bot tokens
    /xoxp-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/, // User tokens
    /xoxa-[0-9]+-[a-zA-Z0-9]+/, // App-level tokens
    /xoxs-[0-9]+-[0-9]+-[a-zA-Z0-9]+/, // Workspace tokens
    /xox[abps]-[0-9A-Za-z-]+/, // Generic pattern
  ];

  metadata: ProviderMetadata = {
    scraperUse: true,
    verificationUse: true,
    displayInUI: true,
    category: ProviderCategory.Communication,
    notifyOwnerDirectly: false,
  };

  protected isValidKeyFormat(apiKey: string): boolean {
    if (!apiKey) return false;
    return (
      apiKey.startsWith('xoxb-') ||
      apiKey.startsWith('xoxp-') ||
      apiKey.startsWith('xoxa-') ||
      apiKey.startsWith('xoxs-')
    );
  }

  protected async validateKeyWithHttp(apiKey: string): Promise<ValidationResult> {
    try {
      const response = await this.fetchWithTimeout(API_ENDPOINTS.SLACK, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const body = await response.text();

      // Slack always returns 200, check response body for actual result
      if (this.isSuccessStatus(response.status)) {
        // Check for success in response body
        if (body.includes('"ok":true') || body.includes('"ok": true')) {
          const metadata = this.extractMetadata(body);
          return ValidationResultFactory.success(response.status, metadata, true);
        }

        // Check for invalid auth errors
        if (body.includes('invalid_auth') || body.includes('token_revoked')) {
          return ValidationResultFactory.unauthorized(
            response.status,
            'Invalid or revoked Slack token'
          );
        }

        // Generic failure
        if (body.includes('"ok":false') || body.includes('"ok": false')) {
          return ValidationResultFactory.unauthorized(
            response.status,
            `Slack API returned error: ${this.truncateResponse(body)}`
          );
        }
      }

      // Rate limited
      if (response.status === 429) {
        return ValidationResultFactory.success(response.status, undefined, true);
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

  private extractMetadata(responseBody: string): ModelInfo[] | undefined {
    const metadata: ModelInfo[] = [];

    try {
      const data = JSON.parse(responseBody);

      if (data.team) {
        metadata.push({
          modelId: 'team',
          displayName: 'Team',
          description: data.team,
        });
      }

      if (data.team_id) {
        metadata.push({
          modelId: 'team_id',
          displayName: 'Team ID',
          description: data.team_id,
        });
      }

      if (data.user) {
        metadata.push({
          modelId: 'user',
          displayName: 'User',
          description: data.user,
        });
      }

      if (data.user_id) {
        metadata.push({
          modelId: 'user_id',
          displayName: 'User ID',
          description: data.user_id,
        });
      }

      if (data.bot_id) {
        metadata.push({
          modelId: 'bot_id',
          displayName: 'Bot ID',
          description: data.bot_id,
        });
      }
    } catch {
      // Ignore parsing errors
    }

    return metadata.length > 0 ? metadata : undefined;
  }
}
