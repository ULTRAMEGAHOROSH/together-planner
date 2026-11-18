import { FormControl } from '@angular/forms';
import { PASSWORD_MAX_BYTES } from '@shared/domain';
import { maxUtf8Bytes, notBlank } from './validators';

const errorsOf = (value: unknown, validator: typeof notBlank) => validator(new FormControl(value));

describe('notBlank', () => {
  it.each([
    ['', { notBlank: true }],
    ['   ', { notBlank: true }],
    ['\n\t ', { notBlank: true }],
    [null, { notBlank: true }],
    [undefined, { notBlank: true }],
    ['Ужин', null],
    ['  Ужин  ', null],
    [0, null],
    [['WORK'], null],
  ])('%j → %j', (value, expected) => {
    expect(errorsOf(value, notBlank)).toEqual(expected);
  });
});

describe('maxUtf8Bytes', () => {
  const max72 = maxUtf8Bytes(PASSWORD_MAX_BYTES);

  it('FE-04: 40 Cyrillic letters (80 bytes) are rejected by maxUtf8Bytes(72)', () => {
    expect(errorsOf('пароль'.repeat(7).slice(0, 40), max72)).toEqual({
      maxUtf8Bytes: { max: 72, actual: 80 },
    });
  });

  it.each([
    ['72 Latin letters', 'a'.repeat(72), null],
    ['73 Latin letters', 'a'.repeat(73), { maxUtf8Bytes: { max: 72, actual: 73 } }],
    ['36 Cyrillic letters (72 bytes)', 'я'.repeat(36), null],
    ['18 emoji (72 bytes)', '🙂'.repeat(18), null],
    ['19 emoji (76 bytes)', '🙂'.repeat(19), { maxUtf8Bytes: { max: 72, actual: 76 } }],
    ['empty', '', null],
    ['not text', null, null],
  ])('%s', (_, value, expected) => {
    expect(errorsOf(value, max72)).toEqual(expected);
  });
});
