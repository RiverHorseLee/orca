import type { CustomUsageError } from '../../shared/custom-usage-contract'
export class CustomUsageFetchError extends Error {
  constructor(
    readonly kind: CustomUsageError,
    readonly retryAfterMs = 0
  ) {
    super(kind)
  }
}
export function customUsageFailure(error: unknown): CustomUsageError {
  return error instanceof CustomUsageFetchError ? error.kind : 'script'
}
