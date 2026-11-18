import {
  EVENT_TITLE_MAX,
  EVENT_DESCRIPTION_MAX,
  EVENT_MAX_DURATION_MINUTES,
  EVENT_YEAR_MIN,
  EVENT_YEAR_MAX,
  PARTICIPANTS_MIN,
  PARTICIPANTS_MAX,
  EVENT_RANGE_MAX_DAYS,
  TEMPLATE_NAME_MAX,
  TEMPLATE_DESCRIPTION_MAX,
  TEMPLATE_EVENTS_MAX,
  TEMPLATE_DURATION_MIN,
  TEMPLATE_DURATION_MAX,
  WORKSPACE_NAME_MAX,
  TIME_ZONE_MAX,
  INVITE_CODE_MAX,
  DISPLAY_NAME_MAX,
  EMAIL_MAX,
  PASSWORD_MIN,
  PASSWORD_MAX,
  PASSWORD_MAX_BYTES,
  PAGE_SIZE_MAX,
  utf8Length,
} from './event-constraints';

describe('event constraints (FD-82)', () => {
  it('match the backend limits', () => {
    expect(EVENT_TITLE_MAX).toBe(100);
    expect(EVENT_DESCRIPTION_MAX).toBe(2000);
    expect(EVENT_MAX_DURATION_MINUTES).toBe(44640);
    expect(EVENT_YEAR_MIN).toBe(2000);
    expect(EVENT_YEAR_MAX).toBe(2100);
    expect(PARTICIPANTS_MIN).toBe(1);
    expect(PARTICIPANTS_MAX).toBe(2);
    expect(EVENT_RANGE_MAX_DAYS).toBe(93);
    expect(TEMPLATE_NAME_MAX).toBe(60);
    expect(TEMPLATE_DESCRIPTION_MAX).toBe(500);
    expect(TEMPLATE_EVENTS_MAX).toBe(300);
    expect(TEMPLATE_DURATION_MIN).toBe(1);
    expect(TEMPLATE_DURATION_MAX).toBe(10080);
    expect(WORKSPACE_NAME_MAX).toBe(60);
    expect(TIME_ZONE_MAX).toBe(64);
    expect(INVITE_CODE_MAX).toBe(20);
    expect(DISPLAY_NAME_MAX).toBe(50);
    expect(EMAIL_MAX).toBe(254);
    expect(PASSWORD_MIN).toBe(8);
    expect(PASSWORD_MAX).toBe(72);
    expect(PASSWORD_MAX_BYTES).toBe(72);
    expect(PAGE_SIZE_MAX).toBe(100);
  });

  it('utf8Length counts bytes like the backend (Cyrillic = 2, emoji = 4)', () => {
    expect(utf8Length('')).toBe(0);
    expect(utf8Length('password')).toBe(8);
    expect(utf8Length('пароль')).toBe(12);
    expect(utf8Length('😀')).toBe(4);
    // 40 Cyrillic letters fit the 72-character limit but not the 72-byte one.
    const cyrillic = 'я'.repeat(40);
    expect(cyrillic.length).toBeLessThanOrEqual(PASSWORD_MAX);
    expect(utf8Length(cyrillic)).toBeGreaterThan(PASSWORD_MAX_BYTES);
  });
});
