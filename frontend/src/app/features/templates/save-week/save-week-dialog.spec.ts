import { Dialog } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AUTH_RESPONSE,
  TEMPLATE_CREATED,
  WEEK,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import type { EventResponse } from '@core/api/models/event.models';
import type { WorkspaceResponse } from '@core/api/models/workspace.models';
import { SessionStore } from '@core/auth/session-store';
import { DataChanges } from '@core/changes/data-changes';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ToastService } from '@core/notify/toast-service';
import { CLOCK } from '@core/time/zone-clock';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { dialogElement, provideVisibleElements } from '@shared/ui/dialog/testing';
import { SAVED_TEXT, openSaveWeek, SaveWeekDialog } from './save-week-dialog';

const WS = WORKSPACE_FULL_PAIR.id;
const WEEK_URL =
  (date: string) => (r: { url: string; params: { get(k: string): string | null } }) =>
    r.url === `/api/v1/workspaces/${WS}/week` && r.params.get('date') === date;
const TEMPLATES = `/api/v1/workspaces/${WS}/templates`;
const [A] = WEEK.members;
const event = (patch: Partial<EventResponse>) =>
  ({
    ...WEEK.events[0],
    title: 'Событие',
    description: null,
    start: '2026-11-17T08:00:00',
    end: '2026-11-17T09:00:00',
    participantIds: [A.userId],
    source: null,
    ...patch,
  }) as unknown as EventResponse;
const week = (weekStart: string, events: EventResponse[]) => ({ ...WEEK, weekStart, events });
// Thursday 19.11.2026 in Almaty: the current week starts on 16.11.
const NOW = Date.UTC(2026, 10, 19, 9, 20);

describe('SaveWeekDialog (TPL-12, OQ-3)', () => {
  let appRef: ApplicationRef;
  let backend: HttpTestingController;
  let closed: unknown[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideVisibleElements(),
        { provide: CLOCK, useValue: () => NOW },
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace({
      ...WORKSPACE_FULL_PAIR,
      members: WEEK.members,
    } as unknown as WorkspaceResponse);
    appRef = TestBed.inject(ApplicationRef);
    backend = TestBed.inject(HttpTestingController);
    closed = [];
  });

  afterEach(() => backend.verify());

  const root = () => dialogElement() as HTMLElement;
  const text = () => root().textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
    ) as HTMLButtonElement;
  const nameInput = () => root().querySelector('input') as HTMLInputElement;
  const instance = () => TestBed.inject(Dialog).openDialogs[0].componentInstance as SaveWeekDialog;

  async function open(events: EventResponse[], weekStart = '2026-11-16') {
    openSaveWeek(TestBed.inject(DialogService), { weekStart: '2026-11-19' }).subscribe((r) =>
      closed.push(r),
    );
    await appRef.whenStable();
    backend.expectOne(WEEK_URL('2026-11-16')).flush(week(weekStart, events));
    await appRef.whenStable();
  }

  it('asks S1 for the week, says what goes in; the name is the week with the year', async () => {
    openSaveWeek(TestBed.inject(DialogService), { weekStart: '2026-11-19' }).subscribe();
    await appRef.whenStable();
    expect(root().querySelector('tp-spinner')).not.toBeNull();
    expect(button('Сохранить').disabled).toBe(true); // while the week loads
    backend.expectOne(WEEK_URL('2026-11-16')).flush(week('2026-11-16', [event({}), event({})]));
    await appRef.whenStable();
    expect(text()).toContain('В шаблон попадёт 2 события.');
    expect(nameInput().value).toBe('Неделя 16–22 нояб. 2026');
    expect(button('Сохранить').disabled).toBe(false);
  });

  it('names what is left out and what is cut, with the reason', async () => {
    await open([
      event({ title: 'Сон', start: '2026-11-15T23:00:00', end: '2026-11-16T07:00:00' }),
      event({ title: 'Отпуск', start: '2026-11-16T00:00:00', end: '2026-12-10T00:00:00' }),
      event({ title: 'Чужое', participantIds: ['gone'] }),
      event({}),
    ]);
    expect(text()).toContain('Не попадут в шаблон: 2');
    expect(text()).toContain('«Сон» — началось на прошлой неделе');
    expect(text()).toContain('«Чужое» — никого из участников пространства');
    expect(text()).toContain('Сокращены до одной недели: 1');
    expect(text()).toContain('«Отпуск»');
    expect(text()).toContain('В шаблон попадёт 2 события.');
  });

  it('an empty week cannot be saved', async () => {
    await open([]);
    expect(text()).toContain('нет событий, которые можно сохранить');
    expect(button('Сохранить').disabled).toBe(true);
  });

  it('over 300 events: the number and the reason, nothing can be saved', async () => {
    await open(Array.from({ length: 301 }, (_, i) => event({ id: `e${i}` })));
    expect(text()).toContain('В этой неделе 301 событий');
    expect(text()).toContain('не больше 300');
    expect(button('Сохранить').disabled).toBe(true);
  });

  it('another week asks S1 again; a newer answer replaces the older', async () => {
    await open([event({})]);
    button('Следующая неделя').click();
    await appRef.whenStable();
    expect(root().querySelector('tp-spinner')).not.toBeNull();
    backend.expectOne(WEEK_URL('2026-11-23')).flush(week('2026-11-23', []));
    await appRef.whenStable();
    expect(nameInput().value).toBe('Неделя 23–29 нояб. 2026');
    expect(instance().weekStart()).toBe('2026-11-23');
  });

  it('a failed week shows the error with «Повторить», which asks again', async () => {
    openSaveWeek(TestBed.inject(DialogService), { weekStart: '2026-11-19' }).subscribe();
    await appRef.whenStable();
    backend
      .expectOne(WEEK_URL('2026-11-16'))
      .flush(null, { status: 500, statusText: 'Server Error' });
    await appRef.whenStable();
    expect(root().querySelector('tp-error-state')).not.toBeNull();
    expect(button('Сохранить').disabled).toBe(true);
    button('Повторить').click();
    backend.expectOne(WEEK_URL('2026-11-16')).flush(week('2026-11-16', [event({})]));
    await appRef.whenStable();
    expect(button('Сохранить').disabled).toBe(false);
  });

  it('«Сохранить»: T2 with the typed name, everybody is told, a toast, the dialog closes', async () => {
    const changed = vi.fn();
    TestBed.inject(DataChanges).templates$.subscribe(changed);
    const show = vi.spyOn(TestBed.inject(ToastService), 'show');
    await open([event({ title: 'Работа' })]);
    nameInput().value = '  Рабочая  ';
    nameInput().dispatchEvent(new Event('input'));
    await appRef.whenStable();
    button('Сохранить').click();
    const req = backend.expectOne(TEMPLATES);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.name).toBe('Рабочая');
    expect(req.request.body.events).toHaveLength(1);
    expect(req.request.body.events[0].id).toBeNull();
    req.flush({ ...TEMPLATE_CREATED, name: 'Рабочая' });
    await appRef.whenStable();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith(SAVED_TEXT('Рабочая', TEMPLATE_CREATED.events.length));
    expect(dialogElement()).toBeNull();
    expect(closed).toHaveLength(1);
  });

  it('a name that is taken lands on the field; the dialog stays and the week is kept', async () => {
    await open([event({})]);
    button('Сохранить').click();
    backend
      .expectOne(TEMPLATES)
      .flush(
        { code: 'TEMPLATE_NAME_TAKEN', status: 409, title: 't', detail: 'd' },
        { status: 409, statusText: 'Conflict' },
      );
    await appRef.whenStable();
    expect(text()).toContain('Шаблон с таким названием уже есть.');
    expect(dialogElement()).not.toBeNull();
    // Typing takes the message back.
    nameInput().value = 'Другое';
    nameInput().dispatchEvent(new Event('input'));
    await appRef.whenStable();
    expect(text()).not.toContain('Шаблон с таким названием уже есть.');
  });

  it('an empty name cannot be saved', async () => {
    await open([event({})]);
    nameInput().value = '   ';
    nameInput().dispatchEvent(new Event('input'));
    await appRef.whenStable();
    expect(text()).toContain('Введите название шаблона.');
    expect(button('Сохранить').disabled).toBe(true);
  });
});
