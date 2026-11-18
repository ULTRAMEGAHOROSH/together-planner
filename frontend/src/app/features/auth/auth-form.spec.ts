import { TestBed } from '@angular/core/testing';
import { NonNullableFormBuilder } from '@angular/forms';
import { controlErrorMessage } from '@shared/forms/server-errors';
import {
  type AuthMode,
  createAuthForm,
  setAuthMode,
  toLoginRequest,
  toRegisterRequest,
} from './auth-form';

const form = (mode: AuthMode, value: Partial<Record<string, string>> = {}) => {
  const f = createAuthForm(TestBed.inject(NonNullableFormBuilder), mode);
  f.patchValue(value);
  return f;
};

const VALID = { displayName: 'Даулет', email: 'a@example.test', password: 'secret-123' };

describe('auth form', () => {
  it('login: no name control, password only required', () => {
    const f = form('login', { email: 'a@example.test', password: 'x' });
    expect(f.controls.displayName.disabled).toBe(true);
    expect(f.valid).toBe(true);
  });

  it('register: the name is required, the password follows the registration rules', () => {
    const f = form('register', { email: 'a@example.test', password: 'x' });
    expect(f.controls.displayName.enabled).toBe(true);
    expect(controlErrorMessage(f.controls.displayName)).toBe('Заполните поле.');
    expect(controlErrorMessage(f.controls.password)).toBe('Минимум 8 символов.');
  });

  it('switching the mode switches the rules', () => {
    const f = form('register', { ...VALID, password: 'short' });
    expect(f.valid).toBe(false);
    setAuthMode(f, 'login');
    expect(f.valid).toBe(true);
    setAuthMode(f, 'register');
    expect(f.controls.password.hasError('minlength')).toBe(true);
  });

  it.each([
    ['email', '', 'Заполните поле.'],
    ['email', '   ', 'Заполните поле.'],
    ['email', 'not-an-email', 'Введите email, например you@example.com.'],
    // EMAIL_MAX + 1 = 255 characters, well-formed otherwise: Validators.email rejects it.
    [
      'email',
      `a@${Array(4).fill('b'.repeat(60)).join('.')}.eeeeee.cd`,
      'Введите email, например you@example.com.',
    ],
    ['displayName', '   ', 'Заполните поле.'],
    ['displayName', 'я'.repeat(51), 'Не больше 50 символов.'],
    ['password', '        ', 'Заполните поле.'],
    ['password', '1234567', 'Минимум 8 символов.'],
    ['password', 'a'.repeat(73), 'Не больше 72 символов.'],
    // 40 Cyrillic letters: 40 characters, but 80 bytes (BCrypt limit, FD-82).
    ['password', 'я'.repeat(40), 'Слишком длинный текст.'],
  ] as const)('register %s %j → %s', (name, value, message) => {
    const f = form('register', { ...VALID, [name]: value });
    expect(controlErrorMessage(f.controls[name])).toBe(message);
  });

  it.each([
    ['password', 'a'.repeat(72)],
    ['password', 'я'.repeat(36)],
    ['displayName', 'я'.repeat(50)],
  ] as const)('register %s at the limit is valid', (name, value) => {
    expect(form('register', { ...VALID, [name]: value }).valid).toBe(true);
  });

  it('requests: email and name are trimmed, the password is sent as typed', () => {
    const f = form('register', {
      displayName: '  Даулет ',
      email: ' a@example.test ',
      password: ' secret-123 ',
    });
    expect(toRegisterRequest(f)).toEqual({
      email: 'a@example.test',
      password: ' secret-123 ',
      displayName: 'Даулет',
    });
    setAuthMode(f, 'login');
    expect(toLoginRequest(f)).toEqual({ email: 'a@example.test', password: ' secret-123 ' });
  });
});
