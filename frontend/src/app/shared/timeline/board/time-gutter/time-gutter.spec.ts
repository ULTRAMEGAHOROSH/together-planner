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

  it('the red label of the current time on the now line, only while there is a mark', async () => {
    const fixture = TestBed.createComponent(TimeGutter);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.now')).toBeNull();

    fixture.componentRef.setInput('now', { date: '2026-11-06', top: 573, label: '14:20' });
    await fixture.whenStable();
    const label = host.querySelector<HTMLElement>('.now')!;
    expect([label.textContent, label.style.top]).toEqual(['14:20', '573px']);

    fixture.componentRef.setInput('now', { date: '2026-11-06', top: 574, label: '14:21' });
    await fixture.whenStable();
    expect([label.textContent, label.style.top]).toEqual(['14:21', '574px']); // the same element

    fixture.componentRef.setInput('now', null);
    await fixture.whenStable();
    expect(host.querySelector('.now')).toBeNull();
  });
});
