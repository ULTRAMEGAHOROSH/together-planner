import { TestBed } from '@angular/core/testing';
import { WeekViewPreference } from './week-view-preference';

describe('WeekViewPreference (FD-47)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('«Неделя» until a choice is made, then the last choice, even for a new service', () => {
    const preference = TestBed.inject(WeekViewPreference);
    expect(preference.read()).toBe('week');
    preference.write('day');
    expect(preference.read()).toBe('day');
    preference.write('week');
    expect(preference.read()).toBe('week');
    localStorage.setItem('tp.week.view', 'day');
    expect(new WeekViewPreference().read()).toBe('day');
  });

  it('anything unknown in the storage is «Неделя»', () => {
    localStorage.setItem('tp.week.view', 'month');
    expect(TestBed.inject(WeekViewPreference).read()).toBe('week');
  });

  it('a storage that refuses does not break anything: «Неделя», nothing remembered', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const preference = TestBed.inject(WeekViewPreference);
    expect(() => preference.write('day')).not.toThrow();
    expect(preference.read()).toBe('week');
  });
});
