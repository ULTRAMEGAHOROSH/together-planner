import type { ProblemDetail } from './common.models';
import { ERROR_CODES, isErrorCode } from './error-codes';
import * as samples from './testing/samples';

describe('ERROR_CODES (spec §7.4)', () => {
  it('contains the 34 codes of the catalog, without duplicates', () => {
    expect(ERROR_CODES).toHaveLength(34);
    expect(new Set(ERROR_CODES).size).toBe(34);
  });

  it.each([
    ['VALIDATION_FAILED'],
    ['PASSWORD_TOO_LONG'],
    ['REFRESH_TOKEN_ROTATED'],
    ['CSRF_HEADER_MISSING'],
    ['VERSION_CONFLICT'],
    ['APPLY_PLAN_OUTDATED'],
    ['INTERNAL_ERROR'],
  ])('includes %s', (code) => {
    expect(isErrorCode(code)).toBe(true);
  });

  it.each([['UNKNOWN'], ['NETWORK_ERROR'], ['version_conflict'], [409], [null]])(
    'rejects %s',
    (value) => {
      expect(isErrorCode(value)).toBe(false);
    },
  );

  it('every captured backend ProblemDetail carries a known code', () => {
    const all: ProblemDetail[] = Object.values(samples);
    expect(all.length).toBeGreaterThan(0);
    for (const problem of all) {
      expect(isErrorCode(problem.code)).toBe(true);
      expect(problem.type).toBeUndefined();
    }
  });
});
