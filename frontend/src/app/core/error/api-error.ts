// One error type for every failed HTTP call (FD-65). Built by errorInterceptor;
// authInterceptor (AUTH-04) creates `new ApiError('SESSION_EXPIRED')`.
import type { ProblemDetail } from '../api/models/common.models';
import type { ErrorCode } from '../api/models/error-codes';

/** Codes the frontend assigns itself; the backend never sends them. */
export const CLIENT_ERROR_CODES = ['NETWORK_ERROR', 'SESSION_EXPIRED', 'UNKNOWN'] as const;
export type ClientErrorCode = (typeof CLIENT_ERROR_CODES)[number];
export type ApiErrorCode = ErrorCode | ClientErrorCode;

/** `errors[]` of a 400 grouped by field: `{ email: ['…'] }`. Messages are Bean Validation texts. */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export interface ApiErrorInit {
  /** HTTP status; 0 = no response (network) or a client-side error. */
  status?: number;
  /** Backend `detail`: technical text for logs, not for the UI (CORE-01). */
  detail?: string | null;
  fieldErrors?: FieldErrors;
  /** The parsed body when it was a ProblemDetail with a known code. */
  problem?: ProblemDetail | null;
}

export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  readonly detail: string | null;
  readonly fieldErrors: FieldErrors;
  readonly problem: ProblemDetail | null;

  constructor(
    readonly code: ApiErrorCode,
    init: ApiErrorInit = {},
  ) {
    const status = init.status ?? 0;
    super(`${status} ${code}${init.detail ? `: ${init.detail}` : ''}`);
    this.status = status;
    this.detail = init.detail ?? null;
    this.fieldErrors = init.fieldErrors ?? {};
    this.problem = init.problem ?? null;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
