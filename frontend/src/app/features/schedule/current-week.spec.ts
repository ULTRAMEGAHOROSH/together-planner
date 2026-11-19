import { TestBed } from '@angular/core/testing';
import { AUTH_RESPONSE, WORKSPACE_FULL_PAIR } from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { CLOCK } from '@core/time/zone-clock';
import { currentWeekPath } from './current-week';

describe('currentWeekPath', () => {
  function pathAt(instant: number, zone: string | null): string {
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: () => instant }] });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(zone === null ? null : { ...WORKSPACE_FULL_PAIR, timeZone: zone });
    return TestBed.runInInjectionContext(currentWeekPath);
  }

  it('Thursday 12.11 → the Monday 09.11', () => {
    expect(pathAt(Date.UTC(2026, 10, 12, 9, 20), 'Asia/Almaty')).toBe('/week/2026-11-09');
  });

  it('«today» is the date in the workspace zone: Sunday night UTC is already Monday there', () => {
    // 22:30 UTC on Sunday 15.11 is 03:30 on Monday 16.11 in Almaty (UTC+5).
    const sundayNight = Date.UTC(2026, 10, 15, 22, 30);
    expect(pathAt(sundayNight, 'Asia/Almaty')).toBe('/week/2026-11-16');
  });

  it('without a workspace the zone is UTC', () => {
    expect(pathAt(Date.UTC(2026, 10, 15, 22, 30), null)).toBe('/week/2026-11-09');
  });
});
