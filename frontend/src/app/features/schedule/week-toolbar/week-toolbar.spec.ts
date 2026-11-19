import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { WEEK } from '@core/api/models/testing/samples';
import type { IsoDate } from '@core/api/models/common.models';
import type { WeekAddress } from '../week-address';
import { WeekToolbar } from './week-toolbar';

// Thursday 12.11.2026: the current week starts on 09.11.
const TODAY = '2026-11-12';

describe('tp-week-toolbar (WEEK-11, WEEK-13)', () => {
  let fixture: ComponentFixture<WeekToolbar>;
  let moves: WeekAddress[];
  const host = () => fixture.nativeElement as HTMLElement;
  const button = (name: string) =>
    Array.from(host().querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
    ) as HTMLButtonElement;
  const sub = () => host().querySelector('.sub')?.textContent;

  async function render(weekStart: IsoDate, day: IsoDate | null = null, today = TODAY) {
    fixture = TestBed.createComponent(WeekToolbar);
    fixture.componentRef.setInput('weekStart', weekStart);
    fixture.componentRef.setInput('day', day);
    fixture.componentRef.setInput('today', today);
    moves = [];
    fixture.componentInstance.navigate.subscribe((a) => moves.push(a));
    await fixture.whenStable();
  }

  describe('«Неделя»', () => {
    it('NV-01: «›» from 2026-11-09 asks for 2026-11-16', async () => {
      await render('2026-11-09');
      button('Следующая неделя').click();
      expect(moves).toEqual([{ weekStart: '2026-11-16', day: null }]);
    });

    it('«‹» asks for the week before', async () => {
      await render('2026-11-09');
      button('Предыдущая неделя').click();
      expect(moves).toEqual([{ weekStart: '2026-11-02', day: null }]);
    });

    it('NV-02: «‹» across the new year, «›» across it the other way', async () => {
      await render('2026-01-05');
      button('Предыдущая неделя').click();
      expect(moves).toEqual([{ weekStart: '2025-12-29', day: null }]);

      await render('2025-12-29');
      button('Следующая неделя').click();
      expect(moves).toEqual([{ weekStart: '2026-01-05', day: null }]);
    });

    it('NV-03: «Сегодня» asks for the current week', async () => {
      await render('2026-11-23');
      button('Сегодня').click();
      expect(moves).toEqual([{ weekStart: '2026-11-09', day: null }]);
    });

    it('«Сегодня» is off on the current week and on again anywhere else', async () => {
      await render('2026-11-09');
      expect(button('Сегодня').disabled).toBe(true);
      fixture.componentRef.setInput('weekStart', '2026-11-16');
      await fixture.whenStable();
      expect(button('Сегодня').disabled).toBe(false);
    });

    it('the title is the period of the week', async () => {
      await render('2026-11-23');
      expect(host().querySelector('h1')?.textContent).toBe('23 – 29 ноября 2026');
    });

    it('NV-05: the subtitle says which week it is: this, next, last, further away', async () => {
      await render('2026-11-09');
      expect(sub()).toBe('Эта неделя');
      await render('2026-11-16');
      expect(sub()).toBe('Следующая неделя');
      await render('2026-11-02');
      expect(sub()).toBe('Прошлая неделя');
      await render('2026-11-30');
      expect(sub()).toBe('Через 3 недели');
    });

    it('the subtitle names the templates of the week, each once', async () => {
      await render('2026-11-23');
      fixture.componentRef.setInput('appliedTemplates', WEEK.appliedTemplates); // the same one twice
      await fixture.whenStable();
      expect(sub()).toBe('Через 2 недели · шаблон «Обычная неделя»');

      const other = { ...WEEK.appliedTemplates[0], templateName: 'Отпуск' };
      fixture.componentRef.setInput('appliedTemplates', [...WEEK.appliedTemplates, other]);
      await fixture.whenStable();
      expect(sub()).toBe('Через 2 недели · шаблон «Обычная неделя», «Отпуск»');
    });
  });

  describe('«День» (WEEK-13)', () => {
    it('the title is the day, the subtitle the period of its week', async () => {
      await render('2026-11-09', '2026-11-12');
      expect(host().querySelector('h1')?.textContent).toBe('Четверг, 12 ноября');
      expect(sub()).toBe('9 – 15 ноября 2026');
    });

    it('the arrows step by a day', async () => {
      await render('2026-11-09', '2026-11-12');
      button('Следующий день').click();
      button('Предыдущий день').click();
      expect(moves).toEqual([
        { weekStart: '2026-11-09', day: '2026-11-13' },
        { weekStart: '2026-11-09', day: '2026-11-11' },
      ]);
    });

    it('Sunday → «›» → the Monday of the next week; Monday → «‹» → the Sunday before', async () => {
      await render('2026-11-09', '2026-11-15');
      button('Следующий день').click();
      expect(moves).toEqual([{ weekStart: '2026-11-16', day: '2026-11-16' }]);

      await render('2026-11-16', '2026-11-16');
      button('Предыдущий день').click();
      expect(moves).toEqual([{ weekStart: '2026-11-09', day: '2026-11-15' }]);
    });

    it('«Сегодня» asks for today, and is off on today only', async () => {
      await render('2026-11-23', '2026-11-25');
      expect(button('Сегодня').disabled).toBe(false);
      button('Сегодня').click();
      expect(moves).toEqual([{ weekStart: '2026-11-09', day: TODAY }]);

      await render('2026-11-09', TODAY);
      expect(button('Сегодня').disabled).toBe(true);
      await render('2026-11-09', '2026-11-13');
      expect(button('Сегодня').disabled).toBe(false);
    });

    it('the templates of the week follow the period', async () => {
      await render('2026-11-23', '2026-11-25');
      fixture.componentRef.setInput('appliedTemplates', WEEK.appliedTemplates);
      await fixture.whenStable();
      expect(sub()).toBe('23 – 29 ноября 2026 · шаблон «Обычная неделя»');
    });
  });

  describe('the «Неделя / День» switch', () => {
    const radios = () => Array.from(host().querySelectorAll<HTMLButtonElement>('[role="radio"]'));

    it('shows the mode it is given and says what the user chose', async () => {
      await render('2026-11-09');
      const chosen: string[] = [];
      fixture.componentInstance.viewChange.subscribe((v) => chosen.push(v));
      expect(radios().map((r) => [r.textContent?.trim(), r.getAttribute('aria-checked')])).toEqual([
        ['Неделя', 'true'],
        ['День', 'false'],
      ]);
      radios()[1].click();
      expect(chosen).toEqual(['day']);

      fixture.componentRef.setInput('view', 'day');
      await fixture.whenStable();
      expect(radios()[1].getAttribute('aria-checked')).toBe('true');
    });

    it('is not there where only «День» is possible', async () => {
      await render('2026-11-09');
      fixture.componentRef.setInput('canChooseView', false);
      await fixture.whenStable();
      expect(radios()).toHaveLength(0);
    });
  });
});
