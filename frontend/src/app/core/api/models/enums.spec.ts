import {
  APPLY_MODES,
  DAYS_OF_WEEK,
  EVENT_CATEGORIES,
  EVENT_COLORS,
  WORKSPACE_ROLES,
  type ApplyMode,
  type DayOfWeek,
  type EventCategory,
  type EventColor,
  type WorkspaceRole,
} from './enums';

// Expected values are copied from docs/backend-spec-v2.md §5.6 and §8.0 on purpose:
// a change on either side must be a conscious edit of this test.
describe('API enums (spec §5.6, §8.0)', () => {
  it('WorkspaceRole', () => {
    expect(WORKSPACE_ROLES).toEqual(['OWNER', 'MEMBER']);
  });

  it('EventCategory — 9 values in spec order', () => {
    expect(EVENT_CATEGORIES).toEqual([
      'WORK',
      'SLEEP',
      'FOOD',
      'COMMUTE',
      'SPORT',
      'REST',
      'TOGETHER',
      'TRIP',
      'OTHER',
    ]);
  });

  it('EventColor has exactly the EventCategory values (palette keys)', () => {
    expect(EVENT_COLORS).toEqual(EVENT_CATEGORIES);
  });

  it('ApplyMode', () => {
    expect(APPLY_MODES).toEqual(['MERGE', 'FILL', 'REPLACE']);
  });

  it('DayOfWeek — ISO order, Monday first', () => {
    expect(DAYS_OF_WEEK).toEqual([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ]);
  });

  it('union types accept exactly the listed values (compile-time check)', () => {
    const role: WorkspaceRole = 'OWNER';
    const category: EventCategory = 'TOGETHER';
    const color: EventColor = 'TRIP';
    const mode: ApplyMode = 'REPLACE';
    const day: DayOfWeek = 'SUNDAY';
    // @ts-expect-error — not a category
    const wrong: EventCategory = 'WORKOUT';
    expect([role, category, color, mode, day, wrong]).toHaveLength(6);
  });
});
