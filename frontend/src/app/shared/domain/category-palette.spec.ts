import { EVENT_CATEGORIES, EVENT_COLORS } from '@core/api/models/enums';
import {
  EVENT_CREATED_JOINT,
  EVENT_CREATED_MANUAL,
  TEMPLATE_CREATED,
} from '@core/api/models/testing/samples';
import { CATEGORY_PALETTE, colorKeyOf, styleOf } from './category-palette';

const HEX = /^#[0-9A-F]{6}$/;

/** WCAG 2.x contrast ratio of two #RRGGBB colors. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('CATEGORY_PALETTE (FD-62)', () => {
  it('covers every EventCategory and EventColor, in API order', () => {
    expect(Object.keys(CATEGORY_PALETTE)).toEqual([...EVENT_CATEGORIES]);
    expect(Object.keys(CATEGORY_PALETTE)).toEqual([...EVENT_COLORS]);
  });

  it('matches the prototype labels', () => {
    expect(Object.values(CATEGORY_PALETTE).map((s) => s.label)).toEqual([
      'Работа',
      'Сон',
      'Еда',
      'Дорога',
      'Спорт',
      'Отдых',
      'Вместе',
      'Поездка',
      'Другое',
    ]);
  });

  it('has valid, distinct colors', () => {
    const styles = Object.values(CATEGORY_PALETTE);
    for (const { bg, fg, dot } of styles) {
      expect([bg, fg, dot]).toEqual([
        expect.stringMatching(HEX),
        expect.stringMatching(HEX),
        expect.stringMatching(HEX),
      ]);
    }
    expect(new Set(styles.map((s) => s.bg)).size).toBe(9);
    expect(new Set(styles.map((s) => s.dot)).size).toBe(9);
  });

  it('card text is readable on its background (WCAG AA, ≥ 4.5:1)', () => {
    for (const { bg, fg } of Object.values(CATEGORY_PALETTE)) {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('colorKeyOf / styleOf', () => {
  it('uses the category when color is null', () => {
    expect(EVENT_CREATED_MANUAL.color).toBeNull();
    expect(colorKeyOf(EVENT_CREATED_MANUAL)).toBe('WORK');
    expect(styleOf(EVENT_CREATED_MANUAL)).toBe(CATEGORY_PALETTE.WORK);
  });

  it('an explicit color wins over the category', () => {
    expect(EVENT_CREATED_JOINT.category).toBe('TOGETHER');
    expect(colorKeyOf(EVENT_CREATED_JOINT)).toBe('FOOD');
    expect(styleOf(EVENT_CREATED_JOINT).label).toBe('Еда');
  });

  it('works for template events too', () => {
    for (const event of TEMPLATE_CREATED.events) {
      expect(colorKeyOf(event)).toBe(event.color ?? event.category);
    }
  });
});
