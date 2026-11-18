import { plural } from './plural';

const event = (n: number) => plural(n, 'событие', 'события', 'событий');

describe('plural', () => {
  it('FR-06: 1 / 2 / 5 / 11 / 21 → событие / события / событий / событий / событие', () => {
    expect([1, 2, 5, 11, 21].map(event)).toEqual([
      'событие',
      'события',
      'событий',
      'событий',
      'событие',
    ]);
  });

  it('teens are always "many", the last digit decides above them', () => {
    expect([0, 10, 12, 13, 14, 19, 20].map(event)).toEqual(Array(7).fill('событий'));
    expect([22, 34, 102, 1003].map(event)).toEqual(Array(4).fill('события'));
    expect([101, 1001, 31].map(event)).toEqual(Array(3).fill('событие'));
    expect([111, 112, 114, 211, 25, 100].map(event)).toEqual(Array(6).fill('событий'));
  });

  it('ignores the sign and rejects fractions', () => {
    expect(event(-1)).toBe('событие');
    expect(event(-3)).toBe('события');
    expect(() => event(1.5)).toThrow(RangeError);
    expect(() => event(Number.NaN)).toThrow(RangeError);
  });
});
