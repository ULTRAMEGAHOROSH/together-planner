import { EVENT_CREATED_JOINT, EVENT_CREATED_MANUAL, WEEK } from '@core/api/models/testing/samples';
import { initialOf, seatColor, seatTint, whoText } from './participants';

const members = WEEK.members;

describe('participants', () => {
  it('seat colors are references to the design tokens', () => {
    expect(seatColor(1)).toBe('var(--tp-color-seat-1)');
    expect(seatColor(2)).toBe('var(--tp-color-seat-2)');
    expect(seatTint(1)).toBe('var(--tp-color-seat-1-tint)');
    expect(seatTint(2)).toBe('var(--tp-color-seat-2-tint)');
  });

  it('initialOf: first letter in upper case, «?» for an empty name', () => {
    expect(initialOf('айгерим')).toBe('А');
    expect(initialOf('  Даулет ')).toBe('Д');
    expect(initialOf('anna')).toBe('A');
    expect(initialOf('')).toBe('?');
    expect(initialOf('   ')).toBe('?');
    expect(initialOf(null)).toBe('?');
    expect(initialOf(undefined)).toBe('?');
    expect(initialOf('😀 Smile')).toBe('😀'); // whole character, not half of a surrogate pair
  });

  it('whoText for one participant is the name', () => {
    expect(EVENT_CREATED_MANUAL.participantIds).toHaveLength(1);
    expect(whoText(EVENT_CREATED_MANUAL.participantIds, members)).toBe('Даулет');
    expect(whoText([members[1].userId], members)).toBe('Айгерим');
  });

  it('whoText for two participants is «вместе», in any order', () => {
    expect(whoText(EVENT_CREATED_JOINT.participantIds, members)).toBe('вместе');
    expect(whoText([...EVENT_CREATED_JOINT.participantIds].reverse(), members)).toBe('вместе');
  });

  it('whoText for an unknown or missing participant is empty', () => {
    expect(whoText(['00000000-0000-0000-0000-000000000000'], members)).toBe('');
    expect(whoText([], members)).toBe('');
  });
});
