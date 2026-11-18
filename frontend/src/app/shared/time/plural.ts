// Russian plural forms (ported from the prototype, design/Main.dc.html).

/**
 * Picks the Russian form for `count`: `one` (1, 21, 101), `few` (2–4, 22–24)
 * or `many` (0, 5–20, 25–30, 11–14). Only the number decides, the sign does not.
 *
 * `plural(n, 'событие', 'события', 'событий')`
 */
export function plural(count: number, one: string, few: string, many: string): string {
  if (!Number.isInteger(count)) {
    throw new RangeError(`Invalid count: ${count}`);
  }
  const n = Math.abs(count);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return few;
  }
  return many;
}
