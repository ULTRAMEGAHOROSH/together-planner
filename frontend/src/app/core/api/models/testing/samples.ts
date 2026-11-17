// Real backend responses captured from the running backend (2026-11-17), used as
// compile-time contract checks (`satisfies`) and as fixtures in tests.
// Grows in CORE-02 / CORE-03 with auth, workspace, week, event and template samples.
import type { ProblemDetail } from '../common.models';

export const PROBLEM_VALIDATION = {
  detail: 'Invalid request content.',
  instance: '/api/v1/auth/register',
  status: 400,
  title: 'Bad Request',
  code: 'VALIDATION_FAILED',
  errors: [
    { field: 'email', message: 'должно иметь формат адреса электронной почты' },
    { field: 'displayName', message: 'не должно быть пустым' },
    { field: 'password', message: 'размер должен находиться в диапазоне от 8 до 72' },
  ],
} satisfies ProblemDetail;

export const PROBLEM_MALFORMED = {
  detail: 'Failed to read request',
  instance: '/api/v1/auth/login',
  status: 400,
  title: 'Bad Request',
  code: 'MALFORMED_REQUEST',
} satisfies ProblemDetail;

export const PROBLEM_CSRF = {
  detail: 'Missing or invalid X-Requested-With header',
  instance: '/api/v1/auth/login',
  status: 403,
  title: 'Forbidden',
  code: 'CSRF_HEADER_MISSING',
} satisfies ProblemDetail;

export const PROBLEM_INVALID_CREDENTIALS = {
  detail: 'Invalid email or password',
  instance: '/api/v1/auth/login',
  status: 401,
  title: 'Unauthorized',
  code: 'INVALID_CREDENTIALS',
} satisfies ProblemDetail;

export const PROBLEM_UNAUTHORIZED = {
  detail: 'Authentication required',
  instance: '/api/v1/auth/me',
  status: 401,
  title: 'Unauthorized',
  code: 'UNAUTHORIZED',
} satisfies ProblemDetail;
