import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import type { ProblemDetail, ValidationErrorItem } from '../api/models/common.models';
import { isErrorCode } from '../api/models/error-codes';
import { ApiError, type FieldErrors } from './api-error';

/**
 * Turns every HttpErrorResponse into an ApiError (FD-65). Shows nothing to the
 * user (FD-66): the owner of the scenario decides. Other errors pass through unchanged.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) =>
      throwError(() => (error instanceof HttpErrorResponse ? toApiError(error) : error)),
    ),
  );

export function toApiError(response: HttpErrorResponse): ApiError {
  // status 0: no response at all (offline, DNS, CORS, aborted connection).
  if (response.status === 0) {
    return new ApiError('NETWORK_ERROR');
  }
  const body: unknown = response.error;
  if (!isRecord(body)) {
    return new ApiError('UNKNOWN', { status: response.status });
  }
  const detail = typeof body['detail'] === 'string' ? body['detail'] : null;
  const fieldErrors = readFieldErrors(body['errors']);
  const code = body['code'];
  if (!isErrorCode(code)) {
    return new ApiError('UNKNOWN', { status: response.status, detail, fieldErrors });
  }
  return new ApiError(code, {
    status: response.status,
    detail,
    fieldErrors,
    problem: body as unknown as ProblemDetail,
  });
}

function readFieldErrors(errors: unknown): FieldErrors {
  if (!Array.isArray(errors)) {
    return {};
  }
  const result: Record<string, string[]> = {};
  for (const item of errors as unknown[]) {
    if (isValidationErrorItem(item)) {
      (result[item.field] ??= []).push(item.message);
    }
  }
  return result;
}

function isValidationErrorItem(value: unknown): value is ValidationErrorItem {
  return (
    isRecord(value) && typeof value['field'] === 'string' && typeof value['message'] === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
