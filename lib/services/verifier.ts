import { ApiKeyDB } from '../appwrite/database';
import { ProviderRegistry } from '../providers/registry';
import {
  ApiKey,
  ApiStatusEnum,
  ApiTypeEnum,
  ValidationAttemptStatus,
  IApiKeyProvider,
} from '../providers/types';
import { MAX_VALID_KEYS, VERIFICATION_BATCH_SIZE } from '../utils/constants';

/**
 * Verifier result
 */
export interface VerifierResult {
  status: 'success' | 'error';
  verified: number;
  valid: number;
  invalid: number;
  validNoCredits: number;
  currentValidCount: number;
  error?: string;
}

/**
 * Verifier service for validating discovered API keys
 */
export class VerifierService {
  private readonly maxValidKeys: number;
  private readonly batchSize: number;

  constructor(
    maxValidKeys: number = MAX_VALID_KEYS,
    batchSize: number = VERIFICATION_BATCH_SIZE
  ) {
    this.maxValidKeys = maxValidKeys;
    this.batchSize = batchSize;
  }

  /**
   * Run a single verification cycle
   */
  async runVerificationCycle(): Promise<VerifierResult> {
    try {
      // Get current count of valid keys
      const currentValidCount = await ApiKeyDB.countByStatus(ApiStatusEnum.Valid);

      let verified = 0;
      let valid = 0;
      let invalid = 0;
      let validNoCredits = 0;

      if (currentValidCount >= this.maxValidKeys) {
        // Re-verify existing valid keys (oldest first)
        const result = await this.reVerifyExistingKeys();
        verified = result.verified;
        valid = result.valid;
        invalid = result.invalid;
        validNoCredits = result.validNoCredits;
      } else {
        // Verify new unverified keys
        const needed = this.maxValidKeys - currentValidCount;
        const result = await this.verifyNewKeys(Math.min(needed, this.batchSize));
        verified = result.verified;
        valid = result.valid;
        invalid = result.invalid;
        validNoCredits = result.validNoCredits;
      }

      // Get updated valid count
      const updatedValidCount = await ApiKeyDB.countByStatus(ApiStatusEnum.Valid);

      return {
        status: 'success',
        verified,
        valid,
        invalid,
        validNoCredits,
        currentValidCount: updatedValidCount,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Verifier error:', message);
      return {
        status: 'error',
        verified: 0,
        valid: 0,
        invalid: 0,
        validNoCredits: 0,
        currentValidCount: 0,
        error: message,
      };
    }
  }

  /**
   * Verify new unverified keys
   */
  private async verifyNewKeys(
    limit: number
  ): Promise<{ verified: number; valid: number; invalid: number; validNoCredits: number }> {
    const unverifiedKeys = await ApiKeyDB.listUnverified(limit);

    let verified = 0;
    let valid = 0;
    let invalid = 0;
    let validNoCredits = 0;

    for (const key of unverifiedKeys) {
      const result = await this.verifyKey(key);
      verified++;

      if (result.status === ApiStatusEnum.Valid) {
        valid++;
      } else if (result.status === ApiStatusEnum.Invalid) {
        invalid++;
      } else if (result.status === ApiStatusEnum.ValidNoCredits) {
        validNoCredits++;
      }
    }

    return { verified, valid, invalid, validNoCredits };
  }

  /**
   * Re-verify existing valid keys
   */
  private async reVerifyExistingKeys(): Promise<{
    verified: number;
    valid: number;
    invalid: number;
    validNoCredits: number;
  }> {
    const validKeys = await ApiKeyDB.listValid(this.batchSize);

    let verified = 0;
    let valid = 0;
    let invalid = 0;
    let validNoCredits = 0;

    for (const key of validKeys) {
      const result = await this.verifyKey(key);
      verified++;

      if (result.status === ApiStatusEnum.Valid) {
        valid++;
      } else if (result.status === ApiStatusEnum.Invalid) {
        invalid++;
      } else if (result.status === ApiStatusEnum.ValidNoCredits) {
        validNoCredits++;
      }
    }

    return { verified, valid, invalid, validNoCredits };
  }

  /**
   * Verify a single key
   */
  private async verifyKey(
    key: ApiKey
  ): Promise<{ status: ApiStatusEnum; reclassified: boolean }> {
    const providers = this.getProvidersToTry(key);
    const now = new Date().toISOString();

    for (const provider of providers) {
      try {
        const result = await provider.validateKey(key.apiKey);

        // Update last checked time
        await ApiKeyDB.update(key.$id!, {
          lastCheckedUtc: now,
        });

        // Handle valid result
        if (result.status === ValidationAttemptStatus.Valid) {
          const reclassified = key.apiType !== provider.apiType;

          // Update key with valid status
          await ApiKeyDB.update(key.$id!, {
            status: result.hasCredits ? ApiStatusEnum.Valid : ApiStatusEnum.ValidNoCredits,
            apiType: provider.apiType,
            errorCount: 0,
          });

          console.log(
            `[Verifier] Key validated as ${provider.providerName}${reclassified ? ' (reclassified)' : ''}`
          );

          return {
            status: result.hasCredits ? ApiStatusEnum.Valid : ApiStatusEnum.ValidNoCredits,
            reclassified,
          };
        }

        // Handle quota/billing issues (key is valid but no credits)
        if (
          result.status === ValidationAttemptStatus.HttpError &&
          result.detail?.toLowerCase().includes('quota')
        ) {
          const reclassified = key.apiType !== provider.apiType;

          await ApiKeyDB.update(key.$id!, {
            status: ApiStatusEnum.ValidNoCredits,
            apiType: provider.apiType,
            errorCount: 0,
          });

          return { status: ApiStatusEnum.ValidNoCredits, reclassified };
        }

        // Handle network errors
        if (result.status === ValidationAttemptStatus.NetworkError) {
          const newErrorCount = (key.errorCount || 0) + 1;

          if (newErrorCount >= 3) {
            await ApiKeyDB.update(key.$id!, {
              status: ApiStatusEnum.Error,
              errorCount: newErrorCount,
            });
            return { status: ApiStatusEnum.Error, reclassified: false };
          }

          await ApiKeyDB.update(key.$id!, {
            errorCount: newErrorCount,
          });

          // Don't try other providers on network error
          return { status: key.status, reclassified: false };
        }

        // Unauthorized - try next provider
        if (result.status === ValidationAttemptStatus.Unauthorized) {
          continue;
        }
      } catch (error) {
        console.error(`Error verifying with ${provider.providerName}:`, error);
      }
    }

    // No provider validated the key
    await ApiKeyDB.update(key.$id!, {
      status: ApiStatusEnum.Invalid,
    });

    return { status: ApiStatusEnum.Invalid, reclassified: false };
  }

  /**
   * Get list of providers to try for a key
   * Returns assigned provider first, then pattern-matching providers
   */
  private getProvidersToTry(key: ApiKey): IApiKeyProvider[] {
    const result: IApiKeyProvider[] = [];

    // Add assigned provider first
    if (key.apiType !== ApiTypeEnum.Unknown) {
      const assigned = ProviderRegistry.getProviderByType(key.apiType);
      if (assigned) {
        result.push(assigned);
      }
    }

    // Add pattern-matching providers
    const matching = ProviderRegistry.findMatchingProviders(key.apiKey);
    for (const provider of matching) {
      if (!result.some((p) => p.apiType === provider.apiType)) {
        result.push(provider);
      }
    }

    return result;
  }

  /**
   * Get current verification status
   */
  async getStatus(): Promise<{
    validCount: number;
    unverifiedCount: number;
    maxValidKeys: number;
    atCapacity: boolean;
  }> {
    const [validCount, unverifiedCount] = await Promise.all([
      ApiKeyDB.countByStatus(ApiStatusEnum.Valid),
      ApiKeyDB.countByStatus(ApiStatusEnum.Unverified),
    ]);

    return {
      validCount,
      unverifiedCount,
      maxValidKeys: this.maxValidKeys,
      atCapacity: validCount >= this.maxValidKeys,
    };
  }
}

/**
 * Create verifier service instance
 */
export function createVerifierService(
  maxValidKeys?: number,
  batchSize?: number
): VerifierService {
  return new VerifierService(maxValidKeys, batchSize);
}
