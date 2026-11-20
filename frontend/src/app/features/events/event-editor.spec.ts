import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  AUTH_RESPONSE,
  EVENT_CREATED_MANUAL,
  PROBLEM_VALIDATION,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import type { ProblemDetail } from '@core/api/models/common.models';
import type { EventResponse } from '@core/api/models/event.models';
import { SessionStore } from '@core/auth/session-store';
import { DataChanges } from '@core/changes/data-changes';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ERROR_MESSAGES } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';
import { CLOCK } from '@core/time/zone-clock';
import { ViewContext } from '@core/view/view-context';
import { dialogElement, pressEscape, provideVisibleElements } from '@shared/ui/dialog/testing';
import { EventEditor } from './event-editor';

const EVENTS = `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/events`;
// Thursday 12.11.2026 14:20 in Almaty: today is 2026-11-12, the current week starts on 09.11.
const NOW = Date.UTC(2026, 10, 12, 9, 20);
const [FIRST, SECOND] = WORKSPACE_FULL_PAIR.members;

const END_BEFORE_START: ProblemDetail = {
  detail: 'End must be after start',
  instance: EVENTS,
  status: 400,
  title: 'Bad Request',
  code: 'EVENT_END_NOT_AFTER_START',
};

describe('EventEditor (EVT-04)', () => {
  let appRef: ApplicationRef;
  let editor: EventEditor;
  let backend: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let eventsChanged: number;

  const dialog = () => dialogElement()!;
  const input = (label: string) =>
    dialog().querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  const title = () => dialog().querySelector<HTMLInputElement>('input[formcontrolname="title"]')!;
  const pressedPeople = () =>
    Array.from(dialog().querySelectorAll('.person')).map((p) => p.getAttribute('aria-pressed'));
  const toast = () => TestBed.inject(ToastService).current();

  async function type(element: HTMLInputElement, value: string) {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await appRef.whenStable();
  }

  async function submit() {
    dialog()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await appRef.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        provideVisibleElements(),
        { provide: CLOCK, useValue: () => NOW },
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    appRef = TestBed.inject(ApplicationRef);
    editor = TestBed.inject(EventEditor);
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    eventsChanged = 0;
    TestBed.inject(DataChanges).events$.subscribe(() => eventsChanged++);
  });

  afterEach(async () => {
    pressEscape();
    await appRef.whenStable();
    backend.verify();
  });

  describe('openCreate', () => {
    it('opens a dialog filled from the place: the day, the time, an hour, that person', async () => {
      editor.openCreate({ date: '2026-11-20', minute: 1170, personSeat: 2 });
      await appRef.whenStable();

      expect(dialog().querySelector('h2')?.textContent?.trim()).toBe('Новое событие');
      expect(input('Дата начала').value).toBe('2026-11-20');
      expect(input('Время начала').value).toBe('19:30');
      expect(input('Время окончания').value).toBe('20:30');
      expect(pressedPeople()).toEqual(['false', 'true']);
      backend.expectNone(() => true);
    });

    it('«Сохранить» sends E3 with the form as the request and keeps the dialog until the answer', async () => {
      editor.openCreate({ date: '2026-11-20', minute: 480, personSeat: 1 });
      await appRef.whenStable();
      await type(title(), '  Поездка ');
      await type(input('Время окончания'), '20:00');

      await submit();

      const request = backend.expectOne(EVENTS);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        title: 'Поездка',
        description: null,
        start: '2026-11-20T08:00',
        end: '2026-11-20T20:00',
        participantIds: [FIRST.userId],
        category: 'OTHER',
        color: null,
      });
      expect(dialogElement()).not.toBeNull();
      expect(eventsChanged).toBe(0);

      request.flush(EVENT_CREATED_MANUAL);
      await appRef.whenStable();

      expect(dialogElement()).toBeNull();
      expect(eventsChanged).toBe(1);
    });

    it('both people go as participantIds in seat order', async () => {
      editor.openCreate({ date: '2026-11-20', minute: 480, personSeat: 2 });
      await appRef.whenStable();
      await type(title(), 'Ужин');
      dialog().querySelector<HTMLButtonElement>('.both')!.click();
      await appRef.whenStable();

      await submit();

      expect(backend.expectOne(EVENTS).request.body.participantIds).toEqual([
        FIRST.userId,
        SECOND.userId,
      ]);
    });

    it('an event on a week that is not on screen: a toast with «Показать» that goes there', async () => {
      // The event is on the week of 23.11; nothing is on screen (no schedule page).
      editor.openCreate({ date: '2026-11-23', minute: 480, personSeat: 1 });
      await appRef.whenStable();
      await type(title(), 'Работа');
      await submit();
      backend.expectOne(EVENTS).flush(EVENT_CREATED_MANUAL);
      await appRef.whenStable();

      expect(toast()?.text).toBe('Событие создано');
      expect(toast()?.action?.label).toBe('Показать');
      expect(navigate).not.toHaveBeenCalled();

      TestBed.inject(ToastService).runAction();

      expect(navigate).toHaveBeenCalledExactlyOnceWith('/week/2026-11-23');
    });

    it('an event on another week than the one on screen also offers «Показать»', async () => {
      TestBed.inject(ViewContext).setFocusDate('2026-11-12');
      editor.openCreate({ date: '2026-11-23', minute: 480, personSeat: 1 });
      await appRef.whenStable();
      await type(title(), 'Работа');
      await submit();
      backend.expectOne(EVENTS).flush(EVENT_CREATED_MANUAL);
      await appRef.whenStable();

      expect(toast()?.action?.label).toBe('Показать');
    });

    it('an event on the week on screen: just «Событие создано»', async () => {
      TestBed.inject(ViewContext).setFocusDate('2026-11-25');
      editor.openCreate({ date: '2026-11-23', minute: 480, personSeat: 1 });
      await appRef.whenStable();
      await type(title(), 'Работа');
      await submit();
      backend.expectOne(EVENTS).flush(EVENT_CREATED_MANUAL);
      await appRef.whenStable();

      expect(toast()?.text).toBe('Событие создано');
      expect(toast()?.action).toBeNull();
    });

    it('a 400 of the server lands at the field: the dialog stays, nothing is announced', async () => {
      editor.openCreate({ date: '2026-11-20', minute: 480, personSeat: 1 });
      await appRef.whenStable();
      await type(title(), 'Ужин');
      await submit();

      backend.expectOne(EVENTS).flush(END_BEFORE_START, { status: 400, statusText: 'Bad Request' });
      await appRef.whenStable();

      expect(dialogElement()).not.toBeNull();
      expect(dialog().querySelector('.error')?.textContent?.trim()).toBe(
        ERROR_MESSAGES.EVENT_END_NOT_AFTER_START,
      );
      expect(eventsChanged).toBe(0);
      expect(toast()).toBeNull();
    });

    it('VALIDATION_FAILED marks the fields the server names', async () => {
      editor.openCreate({ date: '2026-11-20', minute: 480, personSeat: 1 });
      await appRef.whenStable();
      await type(title(), 'Ужин');
      await submit();

      backend
        .expectOne(EVENTS)
        .flush(
          { ...PROBLEM_VALIDATION, errors: [{ field: 'title', message: 'x' }] },
          { status: 400, statusText: 'Bad Request' },
        );
      await appRef.whenStable();

      expect(dialog().querySelector('.error')?.textContent?.trim()).toBe('Проверьте это поле.');
    });

    it('another error is a toast and the dialog stays for another try', async () => {
      editor.openCreate({ date: '2026-11-20', minute: 480, personSeat: 1 });
      await appRef.whenStable();
      await type(title(), 'Ужин');
      await submit();

      backend.expectOne(EVENTS).flush(
        {
          detail: 'x',
          instance: EVENTS,
          status: 500,
          title: 'Server Error',
          code: 'INTERNAL_ERROR',
        },
        { status: 500, statusText: 'Server Error' },
      );
      await appRef.whenStable();

      expect(toast()?.text).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
      expect(dialogElement()).not.toBeNull();
      expect(eventsChanged).toBe(0);
    });

    it('a cancel sends nothing and announces nothing', async () => {
      editor.openCreate({ date: '2026-11-20', minute: 480, personSeat: 1 });
      await appRef.whenStable();

      pressEscape();
      await appRef.whenStable();

      expect(dialogElement()).toBeNull();
      expect(eventsChanged).toBe(0);
      expect(toast()).toBeNull();
    });

    it('without a workspace there is nothing to create in', async () => {
      TestBed.inject(SessionStore).setWorkspace(null);

      editor.openCreate({ date: '2026-11-20', minute: 480, personSeat: 1 });
      await appRef.whenStable();

      expect(dialogElement()).toBeNull();
    });
  });

  describe('openEdit (EVT-05)', () => {
    const EVENT: EventResponse = {
      ...EVENT_CREATED_MANUAL,
      title: 'Ужин',
      description: 'у моря',
      start: '2026-11-25T19:00:00',
      end: '2026-11-25T21:00:00',
      participantIds: [FIRST.userId],
      category: 'FOOD',
      version: 4,
    };
    const ONE = `${EVENTS}/${EVENT.id}`;

    it('opens the dialog filled from the event; the template note only for a template event', async () => {
      editor.openEdit(EVENT);
      await appRef.whenStable();

      expect(dialog().querySelector('h2')?.textContent?.trim()).toBe('Изменить событие');
      expect(title().value).toBe('Ужин');
      expect(input('Время начала').value).toBe('19:00');
      expect(pressedPeople()).toEqual(['true', 'false']);
      expect(dialog().querySelector('.note')).toBeNull();
      expect(dialog().textContent).toContain('Удалить');
      backend.expectNone(() => true);

      pressEscape();
      await appRef.whenStable();
      editor.openEdit({
        ...EVENT,
        source: { templateEventId: 't', weekStart: '2026-11-23', templateName: 'Обычная неделя' },
      });
      await appRef.whenStable();
      expect(dialog().querySelector('.note')?.textContent).toContain('«Обычная неделя»');
    });

    it('«Сохранить» sends E5 with the version of the event and announces the change', async () => {
      TestBed.inject(ViewContext).setFocusDate('2026-11-23');
      editor.openEdit(EVENT);
      await appRef.whenStable();
      await type(title(), 'Поздний ужин');
      await submit();

      const request = backend.expectOne(ONE);
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({
        title: 'Поздний ужин',
        description: 'у моря',
        start: '2026-11-25T19:00',
        end: '2026-11-25T21:00',
        participantIds: [FIRST.userId],
        category: 'FOOD',
        color: null,
        version: 4,
      });
      request.flush({ ...EVENT, title: 'Поздний ужин', version: 5 });
      await appRef.whenStable();

      expect(dialogElement()).toBeNull();
      expect(eventsChanged).toBe(1);
      expect(toast()?.text).toBe('Изменения сохранены');
      expect(toast()?.action).toBeNull();
    });

    it('an event moved to a week that is not on screen: «Показать» goes there', async () => {
      TestBed.inject(ViewContext).setFocusDate('2026-11-23');
      editor.openEdit(EVENT);
      await appRef.whenStable();
      await type(input('Дата начала'), '2026-12-02');
      await submit();

      backend
        .expectOne(ONE)
        .flush({ ...EVENT, start: '2026-12-02T19:00:00', end: '2026-12-02T21:00:00', version: 5 });
      await appRef.whenStable();

      expect(toast()?.text).toBe('Изменения сохранены');
      TestBed.inject(ToastService).runAction();
      expect(navigate).toHaveBeenCalledExactlyOnceWith('/week/2026-11-30');
    });

    it('«Удалить» asks first; then E6 with the version and «Событие удалено»', async () => {
      editor.openEdit(EVENT);
      await appRef.whenStable();
      const remove = () =>
        dialog().querySelector<HTMLButtonElement>('button.remove, button.danger')!;

      remove().click();
      await appRef.whenStable();
      backend.expectNone(() => true);
      expect(remove().textContent).toContain('Точно удалить?');

      remove().click();
      await appRef.whenStable();
      const request = backend.expectOne(`${ONE}?version=4`);
      expect(request.request.method).toBe('DELETE');
      expect(eventsChanged).toBe(0);
      request.flush(null, { status: 204, statusText: 'No Content' });
      await appRef.whenStable();

      expect(dialogElement()).toBeNull();
      expect(eventsChanged).toBe(1);
      expect(toast()?.text).toBe('Событие удалено');
      expect(toast()?.action).toBeNull();
    });

    it('a failed E6 is a toast: the dialog stays and nothing is announced', async () => {
      editor.openEdit(EVENT);
      await appRef.whenStable();
      const remove = () =>
        dialog().querySelector<HTMLButtonElement>('button.remove, button.danger')!;
      remove().click();
      await appRef.whenStable();
      remove().click();
      await appRef.whenStable();

      backend
        .expectOne(`${ONE}?version=4`)
        .flush(
          {
            detail: 'x',
            instance: ONE,
            status: 500,
            title: 'Server Error',
            code: 'INTERNAL_ERROR',
          },
          { status: 500, statusText: 'Server Error' },
        );
      await appRef.whenStable();

      expect(toast()?.text).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
      expect(dialogElement()).not.toBeNull();
      expect(eventsChanged).toBe(0);
    });

    it('a server error stays at the field, a cancel sends nothing, no workspace opens nothing', async () => {
      editor.openEdit(EVENT);
      await appRef.whenStable();
      await submit();
      backend.expectOne(ONE).flush(END_BEFORE_START, { status: 400, statusText: 'Bad Request' });
      await appRef.whenStable();
      expect(dialog().querySelector('.error')?.textContent?.trim()).toBe(
        ERROR_MESSAGES.EVENT_END_NOT_AFTER_START,
      );
      expect(eventsChanged).toBe(0);

      pressEscape();
      await appRef.whenStable();
      expect(eventsChanged).toBe(0);

      TestBed.inject(SessionStore).setWorkspace(null);
      editor.openEdit(EVENT);
      await appRef.whenStable();
      expect(dialogElement()).toBeNull();
    });
  });

  describe('openCreateDefault (the header)', () => {
    it('the day on screen, 19:00, the person who clicked (seat 1)', async () => {
      TestBed.inject(ViewContext).setFocusDate('2026-11-26');

      editor.openCreateDefault();
      await appRef.whenStable();

      expect(input('Дата начала').value).toBe('2026-11-26');
      expect(input('Время начала').value).toBe('19:00');
      expect(input('Время окончания').value).toBe('20:00');
      expect(pressedPeople()).toEqual(['true', 'false']);
    });

    it('without a schedule on screen: today in the workspace zone', async () => {
      editor.openCreateDefault();
      await appRef.whenStable();

      expect(input('Дата начала').value).toBe('2026-11-12');
      expect(input('Время начала').value).toBe('19:00');
    });

    it('the second person starts as themselves', async () => {
      TestBed.inject(SessionStore).setAuth({
        ...AUTH_RESPONSE,
        user: { ...AUTH_RESPONSE.user, id: SECOND.userId },
      });
      // A different user drops the workspace of the old one.
      TestBed.inject(SessionStore).setWorkspace(WORKSPACE_FULL_PAIR);

      editor.openCreateDefault();
      await appRef.whenStable();

      expect(pressedPeople()).toEqual(['false', 'true']);
    });

    it('nothing opens without a workspace, or for a user who is not a member', async () => {
      TestBed.inject(SessionStore).setAuth({
        ...AUTH_RESPONSE,
        user: { ...AUTH_RESPONSE.user, id: 'a-stranger' },
      });
      TestBed.inject(SessionStore).setWorkspace(WORKSPACE_FULL_PAIR);
      editor.openCreateDefault();
      await appRef.whenStable();
      expect(dialogElement()).toBeNull();

      TestBed.inject(SessionStore).setWorkspace(null);
      editor.openCreateDefault();
      await appRef.whenStable();
      expect(dialogElement()).toBeNull();
    });
  });
});
