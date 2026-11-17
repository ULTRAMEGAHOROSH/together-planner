// Error codes of ProblemDetail.code. Source: docs/backend-spec-v2.md §7.4
// (backend: common/error/ErrorCode.java). User-facing texts live in core/error (CORE-04).

export const ERROR_CODES = [
  // 400
  'VALIDATION_FAILED',
  'MALFORMED_REQUEST',
  'INVALID_TIME_ZONE',
  'INVALID_DATE_RANGE',
  'PASSWORD_TOO_LONG',
  'EVENT_END_NOT_AFTER_START',
  'EVENT_TOO_LONG',
  'EVENT_DATE_OUT_OF_RANGE',
  'EVENT_PARTICIPANT_NOT_MEMBER',
  'VERSION_REQUIRED',
  'WEEK_START_NOT_MONDAY',
  'TEMPLATE_EVENT_NOT_FOUND',
  'REPLACE_CONFIRMATION_REQUIRED',
  // 401
  'UNAUTHORIZED',
  'INVALID_CREDENTIALS',
  'REFRESH_TOKEN_INVALID',
  'REFRESH_TOKEN_ROTATED',
  // 403
  'FORBIDDEN',
  'CSRF_HEADER_MISSING',
  // 404
  'WORKSPACE_NOT_FOUND',
  'INVITE_NOT_FOUND',
  'EVENT_NOT_FOUND',
  'TEMPLATE_NOT_FOUND',
  // 409
  'EMAIL_ALREADY_REGISTERED',
  'ALREADY_IN_WORKSPACE',
  'WORKSPACE_FULL',
  'INVITE_EXPIRED',
  'INVITE_ALREADY_USED',
  'TEMPLATE_NAME_TAKEN',
  'VERSION_CONFLICT',
  'TEMPLATE_APPLY_CONFLICT',
  'APPLY_PLAN_OUTDATED',
  'DATA_CONFLICT',
  // 500
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
