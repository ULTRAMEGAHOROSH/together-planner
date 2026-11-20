import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { EventResponse } from '@core/api/models/event.models';
import { EVENT_CREATED_JOINT, EVENT_CREATED_MANUAL, WEEK } from '@core/api/models/testing/samples';
import { CATEGORY_PALETTE } from '@shared/domain';
import { UpcomingList } from './upcoming-list';

@Component({
  imports: [UpcomingList],
  template: `<tp-upcoming-list
    [events]="events()"
    [members]="members"
    today="2026-11-24"
    [loading]="loading()"
    [errorText]="error()"
    (open)="opened.push($event)"
    (create)="created = created + 1"
    (showAll)="shownAll = shownAll + 1"
    (retry)="retried = retried + 1"
  />`,
})
class Host {
  readonly events = signal<EventResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  // The members of the week sample: their ids are the participants of the sample events.
  readonly members = WEEK.members;
  readonly opened: string[] = [];
  created = 0;
  shownAll = 0;
  retried = 0;
}

describe('UpcomingList (CAL-02)', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll<HTMLElement>('.row'));
  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
  });

  it('CAL-03: «Показать все» is always there and says it was pressed', async () => {
    await render();
    const button = Array.from(el().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Показать все',
    )!;
    button.click();
    expect(host.shownAll).toBe(1);
  });

  it('the header, the hint and the button for the future are always there', async () => {
    await render();
    expect(el().querySelector('h2')?.textContent).toBe('Запланировано');
    expect(el().querySelector('.hint')?.textContent).toContain('Будущие события хранятся сами');
    expect(el().querySelector('.future')?.textContent?.trim()).toBe('+ Запланировать на будущее');
  });

  it('a row: the dot of the category, title, time, who, week and the days to it', async () => {
    host.events.set([EVENT_CREATED_JOINT]); // Wed 25.11 19:00–21:00, both, TOGETHER with color FOOD
    await render();
    const [row] = rows();
    expect(row.querySelector('.title')?.textContent).toBe('Ужин вместе');
    expect(row.querySelector('.when')?.textContent).toBe('Ср, 25 нояб. · 19:00–21:00');
    expect(row.querySelector('.meta')?.textContent).toBe('Даулет и Айгерим · неделя 23–29 нояб.');
    expect(row.querySelector('.rel')?.textContent).toBe('завтра');
    // The own color of the event (FOOD) wins over the category.
    expect((row.querySelector('.dot') as HTMLElement).style.background).not.toBe('');
    expect(CATEGORY_PALETTE.FOOD.dot).toBeTruthy();
  });

  it('one participant: just the name', async () => {
    host.events.set([
      { ...EVENT_CREATED_MANUAL, start: '2026-12-01T09:00:00', end: '2026-12-01T10:00:00' },
    ]);
    await render();
    expect(rows()[0].querySelector('.meta')?.textContent).toBe('Даулет · неделя 30 нояб. – 6 дек.');
    expect(rows()[0].querySelector('.rel')?.textContent).toBe('через 7 дней');
  });

  it('an event that has begun is «сегодня», not «0 дней»', async () => {
    host.events.set([
      { ...EVENT_CREATED_MANUAL, start: '2026-11-23T09:00:00', end: '2026-11-25T10:00:00' },
    ]);
    await render();
    expect(rows()[0].querySelector('.rel')?.textContent).toBe('сегодня');
  });

  it('a click on a row gives the event; the button for the future gives «create»', async () => {
    host.events.set([EVENT_CREATED_JOINT, EVENT_CREATED_MANUAL]);
    await render();
    rows()[1].click();
    expect(host.opened).toEqual([EVENT_CREATED_MANUAL.id]);
    el().querySelector<HTMLButtonElement>('.future')?.click();
    expect(host.created).toBe(1);
  });

  it('nothing planned: the empty text instead of the list, the button stays', async () => {
    await render();
    expect(el().querySelector('tp-empty-state')?.textContent).toContain(
      'Пока ничего не запланировано',
    );
    expect(el().querySelector('.list')).toBeNull();
    expect(el().querySelector('.future')).not.toBeNull();
  });

  it('loading: the skeleton, not the empty text', async () => {
    host.loading.set(true);
    await render();
    expect(el().querySelector('.skeleton')).not.toBeNull();
    expect(el().querySelector('tp-empty-state')).toBeNull();
  });

  it('an error: the message with «Повторить»', async () => {
    host.error.set('Не удалось загрузить');
    await render();
    expect(el().querySelector('tp-error-state')?.textContent).toContain('Не удалось загрузить');
    el().querySelector<HTMLButtonElement>('tp-error-state button')?.click();
    expect(host.retried).toBe(1);
    expect(el().querySelector('tp-empty-state')).toBeNull();
  });
});
