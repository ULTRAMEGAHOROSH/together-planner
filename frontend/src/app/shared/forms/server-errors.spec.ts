import { FormArray, FormControl, FormGroup, type ValidatorFn, Validators } from '@angular/forms';
import { ApiError } from '@core/error/api-error';
import { ERROR_MESSAGES, FIELD_ERROR_MESSAGES } from '@core/error/error-messages';
import { applyServerErrors, controlErrorMessage, SERVER_ERROR } from './server-errors';
import { maxUtf8Bytes, notBlank } from './validators';

const validation = (fieldErrors: Record<string, string[]>) =>
  new ApiError('VALIDATION_FAILED', { status: 400, fieldErrors });

function eventForm() {
  return new FormGroup({
    title: new FormControl('Ужин', { nonNullable: true, validators: [notBlank] }),
    start: new FormControl('2026-11-20T19:00', { nonNullable: true }),
    end: new FormControl('2026-11-20T18:00', { nonNullable: true }),
    events: new FormArray([new FormGroup({ title: new FormControl('') })]),
  });
}

describe('applyServerErrors', () => {
  it('FE-01: errors[{field: "end"}] → error on end, form message, end touched', () => {
    const form = eventForm();
    const handled = applyServerErrors(form, validation({ end: ['must be after start'] }));

    expect(handled).toBe(true);
    const end = form.controls.end;
    expect(end.errors).toEqual({ [SERVER_ERROR]: FIELD_ERROR_MESSAGES.invalid });
    expect(end.touched).toBe(true);
    expect(controlErrorMessage(end)).toBe('Проверьте это поле.');
    expect(form.controls.start.errors).toBeNull();
    expect(form.controls.start.touched).toBe(false);
    expect(controlErrorMessage(form)).toBe(ERROR_MESSAGES.VALIDATION_FAILED);
    expect(form.invalid).toBe(true);
  });

  it('FE-02: a code from the map → its text on the mapped control', () => {
    const form = eventForm();
    const error = new ApiError('EVENT_END_NOT_AFTER_START', { status: 400 });

    expect(applyServerErrors(form, error, { EVENT_END_NOT_AFTER_START: 'end' })).toBe(true);
    expect(controlErrorMessage(form.controls.end)).toBe('Окончание должно быть позже начала.');
    expect(form.controls.end.touched).toBe(true);
    // Only the field: no common message for a domain code.
    expect(form.errors).toBeNull();
  });

  it('FE-03: a field the form does not have → error of the form', () => {
    const form = eventForm();
    applyServerErrors(form, validation({ timeZone: ['must not be blank'] }));
    expect(form.errors).toEqual({ [SERVER_ERROR]: ERROR_MESSAGES.VALIDATION_FAILED });
    for (const control of Object.values(form.controls)) expect(control.errors).toBeNull();
  });

  it('a map entry with null, or a path the form lacks, puts the text on the form', () => {
    const form = eventForm();
    applyServerErrors(form, new ApiError('INVALID_CREDENTIALS', { status: 401 }), {
      INVALID_CREDENTIALS: null,
    });
    expect(controlErrorMessage(form)).toBe('Неверный email или пароль.');
    expect(form.touched).toBe(true);

    const other = eventForm();
    applyServerErrors(other, new ApiError('EMAIL_ALREADY_REGISTERED', { status: 409 }), {
      EMAIL_ALREADY_REGISTERED: 'email',
    });
    expect(controlErrorMessage(other)).toBe('Этот email уже зарегистрирован.');
  });

  it('list items: Spring path events[0].title → events.0.title', () => {
    const form = eventForm();
    applyServerErrors(form, validation({ 'events[0].title': ['size must be…'] }));
    expect(form.get('events.0.title')?.errors).toEqual({
      [SERVER_ERROR]: FIELD_ERROR_MESSAGES.invalid,
    });
  });

  it('VALIDATION_FAILED without errors[] → only the form message', () => {
    const form = eventForm();
    expect(applyServerErrors(form, validation({}))).toBe(true);
    expect(controlErrorMessage(form)).toBe('Проверьте заполнение полей.');
  });

  it('keeps client errors already on the control', () => {
    const form = eventForm();
    form.controls.title.setValue('  ');
    applyServerErrors(form, validation({ title: ['must not be blank'] }));
    expect(form.controls.title.errors).toEqual({
      notBlank: true,
      [SERVER_ERROR]: FIELD_ERROR_MESSAGES.invalid,
    });
    // The client text wins: it is more precise.
    expect(controlErrorMessage(form.controls.title)).toBe('Заполните поле.');
  });

  it('server errors disappear on the next edit', () => {
    const form = eventForm();
    applyServerErrors(form, validation({ end: ['x'], timeZone: ['y'] }));
    form.controls.end.setValue('2026-11-20T21:00');
    expect(form.controls.end.errors).toBeNull();
    expect(form.errors).toBeNull();
    expect(form.valid).toBe(true);
  });

  it.each([
    ['network', new ApiError('NETWORK_ERROR')],
    ['conflict', new ApiError('VERSION_CONFLICT', { status: 409 })],
    ['a code not in the map', new ApiError('WORKSPACE_FULL', { status: 409 })],
    ['not an ApiError', new TypeError('bug')],
  ])('%s → false, the form is untouched', (_, error) => {
    const form = eventForm();
    expect(applyServerErrors(form, error, { EVENT_TOO_LONG: 'end' })).toBe(false);
    expect(form.errors).toBeNull();
    expect(form.touched).toBe(false);
    expect(form.valid).toBe(true);
  });
});

describe('controlErrorMessage', () => {
  const control = (value: string, ...validators: ValidatorFn[]) => {
    const c = new FormControl(value, { nonNullable: true, validators });
    return controlErrorMessage(c);
  };

  it.each([
    ['valid', control('Ужин', Validators.required), null],
    ['required', control('', Validators.required), 'Заполните поле.'],
    ['notBlank', control('   ', notBlank), 'Заполните поле.'],
    ['email', control('ужин', Validators.email), 'Введите email, например you@example.com.'],
    ['minlength 8', control('abc', Validators.minLength(8)), 'Минимум 8 символов.'],
    ['minlength 1', control('', Validators.minLength(1), Validators.required), 'Заполните поле.'],
    ['minlength 2', control('a', Validators.minLength(2)), 'Минимум 2 символа.'],
    [
      'maxlength 100',
      control('a'.repeat(101), Validators.maxLength(100)),
      'Не больше 100 символов.',
    ],
    ['maxlength 21', control('a'.repeat(22), Validators.maxLength(21)), 'Не больше 21 символа.'],
    ['maxUtf8Bytes', control('я'.repeat(40), maxUtf8Bytes(72)), 'Слишком длинный текст.'],
    ['other validator', control('a', Validators.pattern(/\d/)), 'Проверьте это поле.'],
  ])('%s', (_, actual, expected) => {
    expect(actual).toBe(expected);
  });

  it('a non-text server value falls back to the generic text', () => {
    const c = new FormControl('');
    c.setErrors({ [SERVER_ERROR]: true });
    expect(controlErrorMessage(c)).toBe('Проверьте это поле.');
  });
});
