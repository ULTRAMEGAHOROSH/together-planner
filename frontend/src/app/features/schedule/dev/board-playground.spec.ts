import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { BoardPlayground } from './board-playground';

describe('BoardPlayground (/_dev/board, WEEK-05)', () => {
  let fixture: ComponentFixture<BoardPlayground>;
  const el = () => fixture.nativeElement as HTMLElement;
  const group = (label: string) =>
    el().querySelector<HTMLElement>(`tp-segmented-control[aria-label="${label}"]`);
  const option = (groupLabel: string, label: string) =>
    Array.from(group(groupLabel)!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label,
    )!;
  const cards = () => el().querySelectorAll('tp-day-column').length;

  beforeEach(async () => {
    fixture = TestBed.createComponent(BoardPlayground);
    await fixture.whenStable();
  });

  it('the board on the fixture pair and week; the scenarios of the card', () => {
    expect(
      Array.from(el().querySelectorAll('tp-person-panel .name')).map((n) => n.textContent),
    ).toEqual(['Daulet', 'Партнёр']);
    expect(cards()).toBe(14);
    expect(
      Array.from(group('Сценарий')!.querySelectorAll('button')).map((b) => b.textContent?.trim()),
    ).toEqual(['Обычная неделя', 'Сон через полночь', 'Пересечения', 'Поездка', 'Граница недели']);
    expect(el().querySelector('tp-day-header.today')?.textContent?.trim()).toBe('Чт 12');
  });

  it('the cards of the fixtures are drawn; a card click is shown', async () => {
    expect(el().querySelectorAll('tp-event-card').length).toBeGreaterThan(50);
    el().querySelector<HTMLButtonElement>('tp-event-card button')!.click();
    await fixture.whenStable();
    expect(el().querySelector('.last-event')?.textContent?.trim()).toMatch(/^Карточка: usual-/);
  });

  it('a frozen clock: the now line stands on Thursday 14:20, whatever the real time is', () => {
    const lines = Array.from(el().querySelectorAll('tp-now-indicator'));
    expect(lines).toHaveLength(2);
    expect(
      lines.map((l) =>
        l.closest('tp-day-column')?.querySelector('.slot')?.getAttribute('aria-label'),
      ),
    ).toEqual([
      'Создать событие для Daulet, четверг, 12 ноября',
      'Создать событие для Партнёр, четверг, 12 ноября',
    ]);
    expect(el().querySelector('tp-time-gutter .now')?.textContent).toBe('14:20');
  });

  it('«День» shows one day (today by default), the day can be picked', async () => {
    option('Режим', 'День').click();
    await fixture.whenStable();
    expect(cards()).toBe(2);
    expect(el().querySelector('tp-day-header')?.textContent?.trim()).toBe('Чт 12');
    option('День', 'Сб').click();
    await fixture.whenStable();
    expect(el().querySelector('tp-day-header')?.textContent?.trim()).toBe('Сб 14');
  });

  it('switching the scenario keeps the board; a slot click is shown', async () => {
    for (const label of ['Сон через полночь', 'Пересечения', 'Поездка', 'Граница недели']) {
      option('Сценарий', label).click();
      await fixture.whenStable();
      expect(cards()).toBe(14);
    }
    const slots = el().querySelectorAll<HTMLButtonElement>('tp-day-column .slot');
    slots[0].click();
    await fixture.whenStable();
    expect(el().querySelector('.last-slot')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Клик: Daulet, 2026-11-09, 540 мин',
    );
    slots[13].click();
    await fixture.whenStable();
    expect(el().querySelector('.last-slot')?.textContent).toContain('Партнёр, 2026-11-15');
  });
});
