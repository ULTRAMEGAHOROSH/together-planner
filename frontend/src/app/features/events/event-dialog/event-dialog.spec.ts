import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import type { EventRequest, EventResponse } from '@core/api/models/event.models';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { ApiError } from '@core/error/api-error';
import { ERROR_MESSAGES, FIELD_ERROR_MESSAGES } from '@core/error/error-messages';
import { ToastService } from '@core/notify/toast-service';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { dialogElement, pressEscape, provideVisibleElements } from '@shared/ui/dialog/testing';
import { fromEventResponse, prefillCreate } from '../event-form';
import { type EventDialogData, type EventDialogResult, openEventDialog } from './event-dialog';

const MEMBERS: MemberResponse[] = [
  { userId: 'u-1', displayName: 'Аня', role: 'OWNER', seat: 1, joinedAt: '2026-11-01T10:00:00Z' },
  {
    userId: 'u-2',
    displayName: 'Борис',
    role: 'MEMBER',
    seat: 2,
    joinedAt: '2026-11-02T10:00:00Z',
  },
];

const SAVED: EventResponse = {
  id: 'e-1',
  title: 'Ужин',
  description: null,
  start: '2026-11-20T10:00',
  end: '2026-11-20T11:00',
  participantIds: ['u-1'],
  category: 'OTHER',
  color: null,
  source: null,
  createdBy: 'u-1',
  updatedBy: 'u-1',
  createdAt: '2026-11-20T07:00:00Z',
  updatedAt: '2026-11-20T07:00:00Z',
  version: 0,
};

describe('EventDialog', () => {
  let appRef: ApplicationRef;
  let result: EventDialogResult | undefined | null;
  let requests: EventRequest[];
  let save: (request: EventRequest) => ReturnType<EventDialogData['save']>;

  const dialog = () => dialogElement()!;
  const field = <T extends HTMLElement>(selector: string) =>
    dialog().querySelector<T>(selector) as T;
  const input = (label: string) => field<HTMLInputElement>(`[aria-label="${label}"]`);
  const title = () => field<HTMLInputElement>('input[formcontrolname="title"]');
  /** A button by its accessible name: the label, else the text without the avatar. */
  const nameOf = (b: HTMLElement) => {
    const copy = b.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('tp-avatar').forEach((a) => a.remove());
    return b.getAttribute('aria-label') ?? copy.textContent?.trim();
  };
  const button = (text: string) =>
    Array.from(dialog().querySelectorAll('button')).find((b) => nameOf(b) === text)!;
  const pressed = (text: string) => button(text).getAttribute('aria-pressed');
  const errorTexts = () =>
    Array.from(dialog().querySelectorAll('.error')).map((e) => e.textContent?.trim());

  async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await appRef.whenStable();
  }

  async function click(element: HTMLElement) {
    element.click();
    await appRef.whenStable();
  }

  async function submit() {
    dialog()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await appRef.whenStable();
  }

  async function open(data: Partial<EventDialogData> = {}) {
    const base = {
      value: { ...prefillCreate({ date: '2026-11-20', minute: 600, personSeat: 1 }) },
      members: MEMBERS,
      templateName: null,
      save: (request: EventRequest) => {
        requests.push(request);
        return save(request);
      },
    };
    openEventDialog(TestBed.inject(DialogService), {
      mode: 'create',
      ...base,
      ...data,
    } as EventDialogData).subscribe((r) => (result = r));
    await appRef.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideVisibleElements()] });
    appRef = TestBed.inject(ApplicationRef);
    result = null;
    requests = [];
    save = () => of(SAVED);
  });

  afterEach(async () => {
    pressEscape();
    await appRef.whenStable();
  });

  describe('markup', () => {
    it('a new event: title, prefilled fields, focus on the name, no «Удалить»', async () => {
      await open();

      expect(dialog().querySelector('h2')?.textContent?.trim()).toBe('Новое событие');
      expect(title().value).toBe('');
      expect(document.activeElement).toBe(title());
      expect(input('Дата начала').value).toBe('2026-11-20');
      expect(input('Время начала').value).toBe('10:00');
      expect(input('Дата окончания').value).toBe('2026-11-20');
      expect(input('Время окончания').value).toBe('11:00');
      expect(pressed('Аня')).toBe('true');
      expect(pressed('Борис')).toBe('false');
      expect(pressed('Как у категории')).toBe('true');
      expect(button('Сохранить').type).toBe('submit');
      expect(button('Отмена').type).toBe('button');
      expect(
        Array.from(dialog().querySelectorAll('button')).some((b) =>
          b.textContent?.includes('Удалить'),
        ),
      ).toBe(false);
      expect(dialog().querySelector('.week')?.textContent).toContain('неделя 16–22 нояб.');
      expect(errorTexts()).toEqual([]);
    });

    it('an edit: the values of the event, «Изменить событие» and «Удалить»', async () => {
      const value = fromEventResponse(
        { ...SAVED, title: 'Поездка', description: 'с видом', category: 'TRIP', color: 'TRIP' },
        MEMBERS,
      );
      await open({ mode: 'edit', value, remove: () => of(null) } as Partial<EventDialogData>);

      expect(dialog().querySelector('h2')?.textContent?.trim()).toBe('Изменить событие');
      expect(title().value).toBe('Поездка');
      expect(field<HTMLTextAreaElement>('textarea').value).toBe('с видом');
      expect(button('Поездка').getAttribute('aria-checked')).toBe('true');
      expect(pressed('Цвет: Поездка')).toBe('true');
      expect(pressed('Как у категории')).toBe('false');
      expect(button('Удалить')).toBeDefined();
    });

    it('an edit without a way to delete has no «Удалить»', async () => {
      await open({ mode: 'edit' } as Partial<EventDialogData>);

      expect(dialog().textContent).not.toContain('Удалить');
    });

    it('«Оба» and the second person are there only when the workspace has two members', async () => {
      await open({ members: MEMBERS.slice(0, 1) });

      expect(dialog().querySelectorAll('.person').length).toBe(1);
      expect(dialog().querySelector('.both')).toBeNull();
    });

    it('an event from a template says where it came from', async () => {
      await open({ templateName: 'Обычная неделя' });

      expect(dialog().querySelector('.note')?.textContent).toContain(
        'Создано из шаблона «Обычная неделя»',
      );
    });

    it('a manual event has no template note', async () => {
      await open();

      expect(dialog().querySelector('.note')).toBeNull();
    });

    it('the dialog is a form: Enter in a field submits through the «Сохранить» button', async () => {
      await open();

      expect(field('form').contains(button('Сохранить'))).toBe(true);
    });
  });

  describe('errors', () => {
    it('are not shown before the first attempt to save', async () => {
      await open();

      expect(errorTexts()).toEqual([]);
    });

    it('an empty name after «Сохранить»: the error shows, nothing is sent', async () => {
      await open();

      await click(button('Сохранить'));
      await submit();

      expect(errorTexts()).toEqual([FIELD_ERROR_MESSAGES.required]);
      expect(title().getAttribute('aria-invalid')).toBe('true');
      expect(requests).toEqual([]);
    });

    it('a field shows its error after blur, before any attempt', async () => {
      await open();

      title().dispatchEvent(new Event('blur'));
      await appRef.whenStable();

      expect(errorTexts()).toEqual([FIELD_ERROR_MESSAGES.required]);
    });

    it('the error goes away when the field is fixed', async () => {
      await open();
      await submit();

      await type(title(), 'Ужин');

      expect(errorTexts()).toEqual([]);
    });

    it('the end not after the start shows under the end, the start stays clean', async () => {
      await open();
      await type(title(), 'Ужин');
      await type(input('Время окончания'), '09:00');

      await submit();

      expect(errorTexts()).toEqual([ERROR_MESSAGES.EVENT_END_NOT_AFTER_START]);
      expect(field('#tp-event-end-error')).not.toBeNull();
      expect(input('Время окончания').getAttribute('aria-describedby')).toBe('tp-event-end-error');
      expect(input('Время начала').getAttribute('aria-invalid')).toBeNull();
      expect(requests).toEqual([]);
    });

    it('a start in 1999 shows under the start', async () => {
      await open();
      await type(title(), 'Ужин');
      await type(input('Дата начала'), '1999-12-31');
      await type(input('Дата окончания'), '1999-12-31');

      await submit();

      expect(errorTexts()).toEqual([ERROR_MESSAGES.EVENT_DATE_OUT_OF_RANGE]);
      expect(input('Дата начала').getAttribute('aria-describedby')).toBe('tp-event-start-error');
    });

    it('a description over 2000 characters shows under the description', async () => {
      await open();
      await type(title(), 'Ужин');
      await type(field<HTMLTextAreaElement>('textarea'), 'а'.repeat(2001));

      await submit();

      expect(errorTexts()).toEqual([FIELD_ERROR_MESSAGES.maxlength(2000)]);
    });

    it('nobody chosen: «Выберите хотя бы одного участника.» after the attempt', async () => {
      await open();
      await type(title(), 'Ужин');
      await click(button('Аня'));

      expect(errorTexts()).toEqual([FIELD_ERROR_MESSAGES.noParticipants]);
      await submit();

      expect(requests).toEqual([]);
    });
  });

  describe('behavior', () => {
    it('«Оба» chooses two participants', async () => {
      await open();
      await type(title(), 'Ужин');

      await click(button('Оба'));
      expect(pressed('Аня')).toBe('true');
      expect(pressed('Борис')).toBe('true');
      expect(pressed('Оба')).toBe('true');
      await submit();

      expect(requests[0].participantIds).toEqual(['u-1', 'u-2']);
    });

    it('a chosen person can be switched off and on again', async () => {
      await open();

      await click(button('Борис'));
      expect(pressed('Борис')).toBe('true');
      await click(button('Аня'));
      expect(pressed('Аня')).toBe('false');
      expect(pressed('Оба')).toBe('false');
    });

    it('moving the start moves the end: the duration stays', async () => {
      await open();

      await type(input('Время начала'), '12:00');

      expect(input('Время окончания').value).toBe('13:00');
      expect(input('Дата окончания').value).toBe('2026-11-20');
    });

    it('editing the end does not move the start', async () => {
      await open();

      await type(input('Время окончания'), '15:00');

      expect(input('Время начала').value).toBe('10:00');
    });

    it('an event over midnight gets the hint, and loses it when it ends the same day', async () => {
      await open();
      expect(dialog().querySelector('.hint-pill')).toBeNull();

      await type(input('Дата окончания'), '2026-11-21');
      expect(dialog().querySelector('.hint-pill')?.textContent).toContain('Через полночь');

      await type(input('Дата окончания'), '2026-11-20');
      expect(dialog().querySelector('.hint-pill')).toBeNull();
    });

    it('no hint while the dates do not make an event', async () => {
      await open();

      await type(input('Дата окончания'), '2026-11-19');

      expect(dialog().querySelector('.hint-pill')).toBeNull();
    });

    it('the week row follows the start and hides while the start is not a date', async () => {
      await open();

      await type(input('Дата начала'), '2026-11-23');
      expect(dialog().querySelector('.week')?.textContent).toContain('неделя 23–29 нояб.');

      await type(input('Дата начала'), '');
      expect(dialog().querySelector('.week')).toBeNull();
    });

    it('the category and the color go into the request', async () => {
      await open();
      await type(title(), 'Пробежка');

      await click(button('Спорт'));
      await click(button('Цвет: Поездка'));
      expect(button('Спорт').getAttribute('aria-checked')).toBe('true');
      expect(pressed('Цвет: Поездка')).toBe('true');
      expect(pressed('Как у категории')).toBe('false');
      await submit();

      expect(requests[0]).toMatchObject({ category: 'SPORT', color: 'TRIP' });
    });

    it('«Как у категории» takes the chosen color back', async () => {
      await open();
      await type(title(), 'Пробежка');
      await click(button('Цвет: Поездка'));

      await click(button('Как у категории'));
      await submit();

      expect(requests[0].color).toBeNull();
    });

    it('the request has trimmed text and the times as typed', async () => {
      await open();
      await type(title(), '  Ужин  ');
      await type(field<HTMLTextAreaElement>('textarea'), '  у моря ');

      await submit();

      expect(requests).toEqual([
        {
          title: 'Ужин',
          description: 'у моря',
          start: '2026-11-20T10:00',
          end: '2026-11-20T11:00',
          participantIds: ['u-1'],
          category: 'OTHER',
          color: null,
        },
      ]);
    });
  });

  describe('save', () => {
    it('closes the dialog with the saved event', async () => {
      await open();
      await type(title(), 'Ужин');

      await submit();

      expect(result).toBe(SAVED);
      expect(dialogElement()).toBeNull();
    });

    it('stays open and busy while the request runs; a second submit sends nothing', async () => {
      const pending = new Subject<EventResponse>();
      save = () => pending;
      await open();
      await type(title(), 'Ужин');

      await submit();
      await submit();

      expect(requests.length).toBe(1);
      expect(button('Сохранить').getAttribute('aria-busy')).toBe('true');
      expect(dialogElement()).not.toBeNull();

      pending.next(SAVED);
      await appRef.whenStable();
      expect(result).toBe(SAVED);
    });

    it('a server error lands on its field; the dialog stays open and can be saved again', async () => {
      save = () => throwError(() => new ApiError('EVENT_END_NOT_AFTER_START', { status: 400 }));
      await open();
      await type(title(), 'Ужин');

      await submit();

      expect(errorTexts()).toEqual([ERROR_MESSAGES.EVENT_END_NOT_AFTER_START]);
      expect(dialogElement()).not.toBeNull();
      expect(button('Сохранить').getAttribute('aria-busy')).toBeNull();
      expect(TestBed.inject(ToastService).current()).toBeNull();

      save = () => of(SAVED);
      await type(input('Время окончания'), '12:00');
      await submit();

      expect(result).toBe(SAVED);
    });

    it('a server error of the participants shows under them', async () => {
      save = () => throwError(() => new ApiError('EVENT_PARTICIPANT_NOT_MEMBER', { status: 400 }));
      await open();
      await type(title(), 'Ужин');

      await submit();

      expect(errorTexts()).toEqual([ERROR_MESSAGES.EVENT_PARTICIPANT_NOT_MEMBER]);
    });

    it('any other error is a toast; the dialog stays open and the form can be sent again', async () => {
      save = () => throwError(() => new ApiError('NETWORK_ERROR'));
      await open();
      await type(title(), 'Ужин');

      await submit();

      expect(TestBed.inject(ToastService).current()?.text).toBe(ERROR_MESSAGES.NETWORK_ERROR);
      expect(errorTexts()).toEqual([]);
      expect(dialogElement()).not.toBeNull();

      save = () => of(SAVED);
      await submit();
      expect(result).toBe(SAVED);
    });
  });

  describe('cancel and delete', () => {
    it('«Отмена», the close button and Esc close without a result', async () => {
      await open();
      await click(button('Отмена'));
      expect(result).toBeUndefined();
      expect(dialogElement()).toBeNull();

      result = null;
      await open();
      await click(button('Закрыть'));
      expect(result).toBeUndefined();

      result = null;
      await open();
      pressEscape();
      await appRef.whenStable();
      expect(result).toBeUndefined();
      expect(requests).toEqual([]);
    });

    it('«Удалить» runs the request and closes with «deleted»', async () => {
      let calls = 0;
      await open({
        mode: 'edit',
        remove: () => {
          calls++;
          return of(null);
        },
      } as Partial<EventDialogData>);

      await click(button('Удалить'));

      expect(calls).toBe(1);
      expect(result).toBe('deleted');
    });

    it('deleting is busy: «Сохранить» is blocked and a second click does nothing', async () => {
      const pending = new Subject<null>();
      let calls = 0;
      await open({
        mode: 'edit',
        remove: () => {
          calls++;
          return pending;
        },
      } as Partial<EventDialogData>);
      await type(title(), 'Ужин');

      await click(button('Удалить'));
      await click(button('Удалить'));
      await submit();

      expect(calls).toBe(1);
      expect(requests).toEqual([]);
      expect(button('Сохранить').disabled).toBe(true);
      expect(button('Удалить').getAttribute('aria-busy')).toBe('true');
      pending.next(null);
      await appRef.whenStable();
      expect(result).toBe('deleted');
    });

    it('a failed delete is a toast; the dialog stays open', async () => {
      await open({
        mode: 'edit',
        remove: () => throwError(() => new ApiError('INTERNAL_ERROR', { status: 500 })),
      } as Partial<EventDialogData>);

      await click(button('Удалить'));

      expect(TestBed.inject(ToastService).current()?.text).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
      expect(dialogElement()).not.toBeNull();
      expect(button('Удалить').getAttribute('aria-busy')).toBeNull();
    });

    it('saving blocks «Удалить»', async () => {
      const pending = new Subject<EventResponse>();
      save = () => pending;
      await open({ mode: 'edit', remove: () => of(null) } as Partial<EventDialogData>);
      await type(title(), 'Ужин');

      await submit();

      expect(button('Удалить').disabled).toBe(true);
    });
  });
});
