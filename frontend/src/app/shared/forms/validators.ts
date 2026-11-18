// Validators the built-in ones do not cover (FD-82). Limits come from
// shared/domain/event-constraints.ts, never as numbers in a form.
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { utf8Length } from '@shared/domain';

/**
 * Text must have something besides spaces (backend `@NotBlank`). Also fails on an empty
 * value, so `Validators.required` is not needed next to it. Non-text values pass.
 */
export function notBlank(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (value === null || value === undefined) return { notBlank: true };
  return typeof value === 'string' && value.trim() === '' ? { notBlank: true } : null;
}

/**
 * Text is at most `max` bytes in UTF-8 (password ≤ 72 bytes: one Cyrillic letter is 2 bytes,
 * an emoji 4). Empty and non-text values pass: emptiness is `notBlank` / `required`.
 */
export function maxUtf8Bytes(max: number): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (typeof value !== 'string') return null;
    const actual = utf8Length(value);
    return actual > max ? { maxUtf8Bytes: { max, actual } } : null;
  };
}
