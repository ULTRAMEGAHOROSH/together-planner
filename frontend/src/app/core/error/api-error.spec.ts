import { ApiError, CLIENT_ERROR_CODES, isApiError } from './api-error';
import { ERROR_CODES } from '../api/models/error-codes';

describe('ApiError', () => {
  it('can be created from a code alone (e.g. SESSION_EXPIRED in authInterceptor)', () => {
    const error = new ApiError('SESSION_EXPIRED');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect([error.code, error.status, error.detail, error.problem]).toEqual([
      'SESSION_EXPIRED',
      0,
      null,
      null,
    ]);
    expect(error.fieldErrors).toEqual({});
    expect(error.message).toBe('0 SESSION_EXPIRED');
  });

  it('keeps status and detail; detail goes into the message for logs', () => {
    const error = new ApiError('VERSION_CONFLICT', { status: 409, detail: 'Version mismatch' });
    expect(error.message).toBe('409 VERSION_CONFLICT: Version mismatch');
  });

  it('isApiError tells ApiError from other values', () => {
    expect(isApiError(new ApiError('UNKNOWN'))).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
    expect(isApiError({ code: 'UNKNOWN', status: 0 })).toBe(false);
    expect(isApiError(null)).toBe(false);
  });

  it('client codes never clash with backend codes', () => {
    const backend: readonly string[] = ERROR_CODES;
    expect(CLIENT_ERROR_CODES.filter((code) => backend.includes(code))).toEqual([]);
  });
});
