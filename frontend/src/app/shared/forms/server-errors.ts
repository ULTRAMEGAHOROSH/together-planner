// Server errors → form controls (FD-83, decisions §9). The only place that reads
// `ApiError.fieldErrors` for forms.
import type { AbstractControl } from '@angular/forms';
import { type ApiErrorCode, isApiError } from '@core/error/api-error';
import { ERROR_MESSAGES, FIELD_ERROR_MESSAGES } from '@core/error/error-messages';

/**
 * Domain codes the form shows at a control: code → control path (`'end'`, `'events.0.title'`).
 * `null` puts the message on the whole form (e.g. `INVALID_CREDENTIALS`).
 */
export type ServerErrorMap = Partial<Record<ApiErrorCode, string | null>>;

/** Key of a server error in `control.errors`; the value is the text to show. */
export const SERVER_ERROR = 'server';

/**
 * Puts a failed request's errors on the form and marks those controls touched, so they show
 * at once. Returns `false` when the error is not for the form (network, conflict, another
 * code): the caller handles it (toast, conflict dialog…).
 *
 * - `VALIDATION_FAILED`: each `errors[].field` gets «Проверьте это поле.»; a field the form
 *   does not have goes to the form; the form also gets the common message.
 * - A code from `fieldMap`: its text from `ERROR_MESSAGES` at the mapped control or the form.
 *
 * Server errors disappear by themselves on the next edit: Angular recomputes `errors` from
 * the validators when a value changes.
 */
export function applyServerErrors(
  form: AbstractControl,
  error: unknown,
  fieldMap: ServerErrorMap = {},
): boolean {
  if (!isApiError(error)) return false;

  if (error.code in fieldMap) {
    const path = fieldMap[error.code] ?? null;
    setServerError((path === null ? null : form.get(path)) ?? form, ERROR_MESSAGES[error.code]);
    return true;
  }
  if (error.code !== 'VALIDATION_FAILED') return false;

  for (const field of Object.keys(error.fieldErrors)) {
    const control = form.get(toControlPath(field));
    if (control) setServerError(control, FIELD_ERROR_MESSAGES.invalid);
  }
  setServerError(form, ERROR_MESSAGES.VALIDATION_FAILED);
  return true;
}

/** Spring names list items `events[0].start`; Angular forms want `events.0.start`. */
function toControlPath(field: string): string {
  return field.replace(/\[(\d+)\]/g, '.$1');
}

function setServerError(control: AbstractControl, text: string): void {
  control.setErrors({ ...control.errors, [SERVER_ERROR]: text });
  control.markAsTouched();
}

/**
 * Text of the first error of a control (or of a form: its server message), `null` if valid.
 * Whether to show it yet (after submit or blur, FD-83) is the caller's decision.
 */
export function controlErrorMessage(control: AbstractControl): string | null {
  const errors = control.errors;
  if (!errors) return null;
  if (errors['required'] || errors['notBlank']) return FIELD_ERROR_MESSAGES.required;
  if (errors['email']) return FIELD_ERROR_MESSAGES.email;
  if (errors['minlength'])
    return FIELD_ERROR_MESSAGES.minlength(errors['minlength'].requiredLength);
  if (errors['maxlength'])
    return FIELD_ERROR_MESSAGES.maxlength(errors['maxlength'].requiredLength);
  if (errors['maxUtf8Bytes']) return FIELD_ERROR_MESSAGES.tooLong;
  if (typeof errors[SERVER_ERROR] === 'string') return errors[SERVER_ERROR];
  return FIELD_ERROR_MESSAGES.invalid;
}
