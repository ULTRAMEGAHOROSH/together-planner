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

  it('a conditional week (TPL-09): the weekday only, no number', async () => {
    const days = buildPanelLayout([], { firstDay: '2001-01-01', dayCount: 7 }, A, {
      today: null,
      withDates: false,
    }).days;
    const fixture = TestBed.createComponent(DayHeader);
    fixture.componentRef.setInput('day', days[2]);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent?.trim()).toBe('Ср');
    expect(host.querySelector('.number')).toBeNull();
  });

  describe('as a button (WEEK-13)', () => {
    async function render(open: boolean, interactive = true) {
      const fixture = TestBed.createComponent(DayHeader);
      fixture.componentRef.setInput('day', WEEK[0]);
      fixture.componentRef.setInput('interactive', interactive);
      fixture.componentRef.setInput('open', open);
      const picked: string[] = [];
      fixture.componentInstance.pick.subscribe((d) => picked.push(d));
      await fixture.whenStable();
      return { host: fixture.nativeElement as HTMLElement, picked };
    }

    it('on a week it opens the day: the name says which, the click gives the date', async () => {
      const { host, picked } = await render(false);
      const button = host.querySelector('button')!;
      expect(button.getAttribute('aria-label')).toBe('Открыть день: понедельник, 9 ноября');
      expect(host.textContent?.replace(/\s+/g, ' ').trim()).toBe('Пн 9');
      button.click();
      expect(picked).toEqual(['2026-11-09']);
    });

    it('on an open day it leads back to the week', async () => {
      const { host } = await render(true);
      expect(host.querySelector('button')?.getAttribute('aria-label')).toBe('Вернуться к неделе');
    });

    it('without interactive it is a plain label', async () => {
      const { host } = await render(false, false);
      expect(host.querySelector('button')).toBeNull();
      expect(host.textContent?.replace(/\s+/g, ' ').trim()).toBe('Пн 9');
    });
  });
});
