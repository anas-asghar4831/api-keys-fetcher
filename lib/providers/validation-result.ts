import { ValidationResult, ValidationAttemptStatus, ModelInfo } from './types';

/**
 * Factory class for creating ValidationResult objects
 */
export const ValidationResultFactory = {
  /**
   * Create a successful validation result
   */
  success(
    httpStatusCode?: number,
    models?: ModelInfo[],
    hasCredits: boolean = true,
    creditBalance?: number
  ): ValidationResult {
    return {
      status: ValidationAttemptStatus.Valid,
      httpStatusCode,
      availableModels: models,
      hasCredits,
      creditBalance,
    };
  },

  /**
   * Create an unauthorized (401) result
   */
  unauthorized(httpStatusCode?: number, detail?: string): ValidationResult {
    return {
      status: ValidationAttemptStatus.Unauthorized,
      httpStatusCode: httpStatusCode ?? 401,
      detail: detail ?? 'Invalid or expired API key',
    };
  },

  /**
   * Create an HTTP error result
   */
  httpError(httpStatusCode: number, detail?: string): ValidationResult {
    return {
      status: ValidationAttemptStatus.HttpError,
      httpStatusCode,
      detail: detail ?? `HTTP error ${httpStatusCode}`,
    };
  },

  /**
   * Create a network error result
   */
  networkError(detail: string): ValidationResult {
    return {
      status: ValidationAttemptStatus.NetworkError,
      detail,
    };
  },

  /**
   * Create a provider-specific error result
   */
  providerError(detail: string): ValidationResult {
    return {
      status: ValidationAttemptStatus.ProviderSpecificError,
      detail,
    };
  },

  /**
   * Create a valid but no credits result
   */
  validNoCredits(
    httpStatusCode?: number,
    detail?: string,
    models?: ModelInfo[]
  ): ValidationResult {
    return {
      status: ValidationAttemptStatus.Valid,
      httpStatusCode,
      detail: detail ?? 'Valid key but no credits/quota',
      availableModels: models,
      hasCredits: false,
    };
  },

  /**
   * Create an unknown status result (for keys that require additional context)
   */
  unknown(detail: string): ValidationResult {
    return {
      status: ValidationAttemptStatus.Unknown,
      detail,
    };
  },

  /**
   * Check if a result indicates the key is valid (with or without credits)
   */
  isValid(result: ValidationResult): boolean {
    return result.status === ValidationAttemptStatus.Valid;
  },

  /**
   * Check if a result should be retried
   */
  shouldRetry(result: ValidationResult): boolean {
    return result.status === ValidationAttemptStatus.NetworkError;
  },
};
