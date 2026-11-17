import { ERROR_CODES } from '../api/models/error-codes';
import { ApiError, CLIENT_ERROR_CODES } from './api-error';
import { ERROR_MESSAGES, messageFor } from './error-messages';

describe('error messages (FD-67)', () => {
  it('ER-05: every backend code of spec §7.4 and every client code has a text', () => {
    const codes = [...ERROR_CODES, ...CLIENT_ERROR_CODES];
    expect(codes).toHaveLength(37);
    for (const code of codes) {
      expect(ERROR_MESSAGES[code], code).toMatch(/\S/);
    }
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual([...codes].sort());
  });

  it('texts are user-facing Russian sentences, not codes', () => {
    for (const text of Object.values(ERROR_MESSAGES)) {
      expect(text).toMatch(/^[А-ЯЁ].*\.$/);
      expect(text).not.toMatch(/[A-Z]{2,}_[A-Z]/);
    }
  });

  it('messageFor: ApiError by code, anything else as UNKNOWN', () => {
    expect(messageFor(new ApiError('INVALID_CREDENTIALS', { status: 401 }))).toBe(
      'Неверный email или пароль.',
    );
    expect(messageFor(new ApiError('SESSION_EXPIRED'))).toBe('Сессия истекла, войдите снова.');
    expect(messageFor(new TypeError('bug'))).toBe(ERROR_MESSAGES.UNKNOWN);
    expect(messageFor(undefined)).toBe(ERROR_MESSAGES.UNKNOWN);
  });

  it('program errors (decisions §9) share the generic text', () => {
    for (const code of [
      'CSRF_HEADER_MISSING',
      'MALFORMED_REQUEST',
      'VERSION_REQUIRED',
      'REPLACE_CONFIRMATION_REQUIRED',
    ] as const) {
      expect(ERROR_MESSAGES[code]).toBe('Что-то пошло не так. Попробуйте ещё раз.');
    }
  });
});
