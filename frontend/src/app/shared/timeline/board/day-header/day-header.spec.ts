import { TestBed } from '@angular/core/testing';
import { A } from '../../testing/event-builder';
import { buildPanelLayout } from '../../engine/panel-layout';
import { DayHeader } from './day-header';

const WEEK = buildPanelLayout([], { firstDay: '2026-11-09', dayCount: 7 }, A, {
  today: '2026-11-12',
}).days;

describe('tp-day-header (WEEK-05)', () => {
  it('«Пн 9»; today is marked for the eye (accent circle) and for screen readers', async () => {
    const fixture = TestBed.createComponent(DayHeader);
    fixture.componentRef.setInput('day', WEEK[0]);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.weekday')?.textContent).toBe('Пн');
    expect(host.querySelector('.number')?.textContent).toBe('9');
    expect(host.classList).not.toContain('today');
    expect(host.getAttribute('aria-current')).toBeNull();

    fixture.componentRef.setInput('day', WEEK[3]);
    await fixture.whenStable();
    expect(host.textContent?.replace(/\s+/g, ' ').trim()).toBe('Чт 12');
    expect(host.classList).toContain('today');
    expect(host.getAttribute('aria-current')).toBe('date');
  });
});
