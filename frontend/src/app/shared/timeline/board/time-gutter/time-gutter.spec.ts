import { TestBed } from '@angular/core/testing';
import { TimeGutter } from './time-gutter';

describe('tp-time-gutter (WEEK-05)', () => {
  it('«время» and 23 labels 01:00…23:00 on the hour lines; hidden from screen readers', async () => {
    const fixture = TestBed.createComponent(TimeGutter);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const hours = Array.from(host.querySelectorAll<HTMLElement>('.hour'));
    expect(host.querySelector('.head')?.textContent).toBe('время');
    expect(hours).toHaveLength(23);
    expect([hours[0].textContent, hours[0].style.top]).toEqual(['01:00', '32px']);
    expect([hours[22].textContent, hours[22].style.top]).toEqual(['23:00', '912px']);
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });
});
