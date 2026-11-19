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
