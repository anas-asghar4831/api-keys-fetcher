import { ApiKeyDB } from '../appwrite/database';
import { ProviderRegistry } from '../providers/registry';
import {
  ApiKey,
  ApiStatusEnum,
  ApiTypeEnum,
  ValidationAttemptStatus,
  IApiKeyProvider,
} from '../providers/types';
import { MAX_VALID_KEYS, VERIFICATION_BATCH_SIZE, VERIFICATION_CONCURRENT } from '../utils/constants';

/**
 * Verification log entry
 */
export interface VerificationLog {
  timestamp: string;
  keyId: string;
  maskedKey: string;
  provider: string;
  result: 'valid' | 'invalid' | 'no_credits' | 'error';
  message: string;
}

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
  logs: VerificationLog[];
  error?: string;
}

/**
 * Verifier service for validating discovered API keys
 */
export class VerifierService {
  private readonly maxValidKeys: number;
  private readonly batchSize: number;
  private readonly concurrentLimit: number;
  private logs: VerificationLog[] = [];

  constructor(
    maxValidKeys: number = MAX_VALID_KEYS,
    batchSize: number = VERIFICATION_BATCH_SIZE,
    concurrentLimit: number = VERIFICATION_CONCURRENT
  ) {
    this.maxValidKeys = maxValidKeys;
    this.batchSize = batchSize;
    this.concurrentLimit = concurrentLimit;
  }

  /**
   * Add a log entry
   */
  private addLog(
    keyId: string,
    apiKey: string,
    provider: string,
    result: VerificationLog['result'],
    message: string
  ) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      keyId,
      maskedKey: this.maskKey(apiKey),
      provider,
      result,
      message,
    });
  }

  /**
   * Mask API key for logging
   */
  private maskKey(apiKey: string): string {
    if (apiKey.length <= 12) return '***';
    return apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
  }

  /**
   * Process items in parallel with concurrency limit
   */
  private async processInParallel<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    limit: number
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const promise = processor(item).then((result) => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= limit) {
        await Promise.race(executing);
        // Remove completed promises
        for (let i = executing.length - 1; i >= 0; i--) {
          const p = executing[i];
          if (await Promise.race([p.then(() => true), Promise.resolve(false)])) {
            executing.splice(i, 1);
          }
        }
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Run a single verification cycle
   */
  async runVerificationCycle(): Promise<VerifierResult> {
    // Clear logs for this run
    this.logs = [];

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
        logs: this.logs,
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
        logs: this.logs,
        error: message,
      };
    }
  }

  /**
   * Verify new unverified keys (in parallel)
   */
  private async verifyNewKeys(
    limit: number
  ): Promise<{ verified: number; valid: number; invalid: number; validNoCredits: number }> {
    const unverifiedKeys = await ApiKeyDB.listUnverified(limit);

    let verified = 0;
    let valid = 0;
    let invalid = 0;
    let validNoCredits = 0;

    // Process keys in parallel with concurrency limit
    const results = await this.processInParallel(
      unverifiedKeys,
      async (key) => {
        const result = await this.verifyKey(key);
        return result.status;
      },
      this.concurrentLimit
    );

    // Count results
    for (const status of results) {
      verified++;
      if (status === ApiStatusEnum.Valid) {
        valid++;
      } else if (status === ApiStatusEnum.Invalid) {
        invalid++;
      } else if (status === ApiStatusEnum.ValidNoCredits) {
        validNoCredits++;
      }
    }

    return { verified, valid, invalid, validNoCredits };
  }

  /**
   * Re-verify existing valid keys (in parallel)
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

    // Process keys in parallel with concurrency limit
    const results = await this.processInParallel(
      validKeys,
      async (key) => {
        const result = await this.verifyKey(key);
        return result.status;
      },
      this.concurrentLimit
    );

    // Count results
    for (const status of results) {
      verified++;
      if (status === ApiStatusEnum.Valid) {
        valid++;
      } else if (status === ApiStatusEnum.Invalid) {
        invalid++;
      } else if (status === ApiStatusEnum.ValidNoCredits) {
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
    const providerName = providers[0]?.providerName || 'Unknown';

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
          const finalStatus = result.hasCredits ? ApiStatusEnum.Valid : ApiStatusEnum.ValidNoCredits;

          // Update key with valid status
          await ApiKeyDB.update(key.$id!, {
            status: finalStatus,
            apiType: provider.apiType,
            errorCount: 0,
          });

          // Add log
          this.addLog(
            key.$id!,
            key.apiKey,
            provider.providerName,
            result.hasCredits ? 'valid' : 'no_credits',
            result.hasCredits
              ? `Valid${reclassified ? ' (reclassified from ' + providerName + ')' : ''}`
              : `Valid but no credits${reclassified ? ' (reclassified)' : ''}`
          );

          return { status: finalStatus, reclassified };
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

          this.addLog(
            key.$id!,
            key.apiKey,
            provider.providerName,
            'no_credits',
            'Valid but quota exceeded'
          );

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

            this.addLog(
              key.$id!,
              key.apiKey,
              provider.providerName,
              'error',
              `Network error (attempt ${newErrorCount}/3) - marked as error`
            );

            return { status: ApiStatusEnum.Error, reclassified: false };
          }

          await ApiKeyDB.update(key.$id!, {
            errorCount: newErrorCount,
          });

          this.addLog(
            key.$id!,
            key.apiKey,
            provider.providerName,
            'error',
            `Network error (attempt ${newErrorCount}/3) - will retry`
          );

          // Don't try other providers on network error
          return { status: key.status, reclassified: false };
        }

        // Unauthorized - try next provider
        if (result.status === ValidationAttemptStatus.Unauthorized) {
          continue;
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.addLog(
          key.$id!,
          key.apiKey,
          provider.providerName,
          'error',
          `Exception: ${errMsg.substring(0, 100)}`
        );
      }
    }

    // No provider validated the key
    await ApiKeyDB.update(key.$id!, {
      status: ApiStatusEnum.Invalid,
    });

    this.addLog(
      key.$id!,
      key.apiKey,
      providerName,
      'invalid',
      'No provider accepted this key'
    );

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
   * Verify a single key by ID
   */
  async verifySingleKey(keyId: string): Promise<{
    status: 'success' | 'error';
    newStatus: number;
    logs: VerificationLog[];
    error?: string;
  }> {
    this.logs = [];

    try {
      const key = await ApiKeyDB.get(keyId);
      if (!key) {
        return { status: 'error', newStatus: -99, logs: [], error: 'Key not found' };
      }

      const result = await this.verifyKey(key);
      return { status: 'success', newStatus: result.status, logs: this.logs };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'error', newStatus: -99, logs: this.logs, error: message };
    }
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
