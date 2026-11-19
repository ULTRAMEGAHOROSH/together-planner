import { formatLocalDateTime } from '@shared/time/local-date-time';
import { A, B, ev } from './event-builder';

describe('ev (timeline test builder)', () => {
  it('local date-times → minutes; joint by the number of participants', () => {
    const night = ev('2026-11-13T23:00', '2026-11-14T07:00', [A]);
    expect(formatLocalDateTime(night.startMin)).toBe('2026-11-13T23:00');
    expect(night.endMin - night.startMin).toBe(8 * 60);
    expect(night.participantIds).toEqual([A]);
    expect(night.joint).toBe(false);
    expect(ev('2026-11-13T09:00', '2026-11-13T10:00', [A, B]).joint).toBe(true);
  });

  it('distinct ids by default; any field can be set', () => {
    const first = ev('2026-11-13T09:00', '2026-11-13T10:00', [A]);
    const second = ev('2026-11-13T09:00', '2026-11-13T10:00', [A]);
    expect(first.id).not.toBe(second.id);
    const custom = ev('2026-11-13T09:00', '2026-11-13T10:00', [B], {
      id: 'x',
      category: 'SPORT',
      color: 'TRIP',
      fromTemplate: true,
    });
    expect(custom).toMatchObject({ id: 'x', category: 'SPORT', color: 'TRIP', fromTemplate: true });
  });
});
