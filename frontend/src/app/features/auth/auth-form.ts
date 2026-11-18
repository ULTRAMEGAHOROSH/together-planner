// Login / registration form (FD-81): the FormGroup, validators per mode and the requests.
// Limits come from shared/domain (FD-82); the backend stays the final check.
import {
  type FormControl,
  type FormGroup,
  NonNullableFormBuilder,
  Validators,
} from '@angular/forms';
import type { LoginRequest, RegisterRequest } from '@core/api/models/auth.models';
import { DISPLAY_NAME_MAX, PASSWORD_MAX, PASSWORD_MAX_BYTES, PASSWORD_MIN } from '@shared/domain';
import type { ServerErrorMap } from '@shared/forms/server-errors';
import { maxUtf8Bytes, notBlank } from '@shared/forms/validators';

export type AuthMode = 'login' | 'register';

export type AuthForm = FormGroup<{
  displayName: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
}>;

/** Domain codes of A1 / A2 shown in the form (decisions §9); `null` — under the form. */
export const AUTH_SERVER_ERRORS: ServerErrorMap = {
  INVALID_CREDENTIALS: null,
  EMAIL_ALREADY_REGISTERED: 'email',
  PASSWORD_TOO_LONG: 'password',
};

// Login checks only what the backend checks there (LoginRequest): an old password
// is not measured against today's rules.
const LOGIN_PASSWORD = [notBlank];
const REGISTER_PASSWORD = [
  notBlank,
  Validators.minLength(PASSWORD_MIN),
  Validators.maxLength(PASSWORD_MAX),
  maxUtf8Bytes(PASSWORD_MAX_BYTES),
];

export function createAuthForm(fb: NonNullableFormBuilder, mode: AuthMode): AuthForm {
  const form = fb.group({
    displayName: ['', [notBlank, Validators.maxLength(DISPLAY_NAME_MAX)]],
    // Validators.email also rejects more than 254 characters (EMAIL_MAX) and a local part > 64.
    email: ['', [notBlank, Validators.email]],
    password: [''],
  });
  setAuthMode(form, mode);
  return form;
}

/** The name exists only for registration (a disabled control is not validated or sent). */
export function setAuthMode(form: AuthForm, mode: AuthMode): void {
  const { displayName, password } = form.controls;
  if (mode === 'register') displayName.enable();
  else displayName.disable();
  password.setValidators(mode === 'register' ? REGISTER_PASSWORD : LOGIN_PASSWORD);
  password.updateValueAndValidity();
}

/**
 * Email and name are trimmed: the backend checks `@Email` before it trims, so
 * `" a@b.test "` would be `VALIDATION_FAILED` (CORE-02). The password is sent as typed.
 */
export function toLoginRequest(form: AuthForm): LoginRequest {
  const { email, password } = form.getRawValue();
  return { email: email.trim(), password };
}

export function toRegisterRequest(form: AuthForm): RegisterRequest {
  const { displayName, email, password } = form.getRawValue();
  return { email: email.trim(), password, displayName: displayName.trim() };
}
