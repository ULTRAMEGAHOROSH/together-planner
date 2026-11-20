import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PageResponse } from '@core/api/models/common.models';
import type { EventResponse } from '@core/api/models/event.models';
import {
  AUTH_RESPONSE,
  EVENT_CREATED_MANUAL,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { CLOCK } from '@core/time/zone-clock';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { dialogElement, provideVisibleElements } from '@shared/ui/dialog/testing';
import { UPCOMING_PAGE_SIZE, UpcomingAllDialog } from './upcoming-all-dialog';

const URL = (page: number) =>
  `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/events/upcoming?page=${page}&size=${UPCOMING_PAGE_SIZE}`;

const event = (n: number, source: EventResponse['source'] = null): EventResponse => ({
  ...EVENT_CREATED_MANUAL,
  id: `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`,
  title: `Событие ${n}`,
  start: '2026-11-25T19:00:00',
  end: '2026-11-25T20:00:00',
  source,
});

const page = (
  items: EventResponse[],
  index: number,
  hasNext: boolean,
): PageResponse<EventResponse> => ({
  items,
  page: index,
  size: UPCOMING_PAGE_SIZE,
  totalElements: 30,
  totalPages: 2,
  hasNext,
});

describe('UpcomingAllDialog (CAL-03)', () => {
  let appRef: ApplicationRef;
  let backend: HttpTestingController;
  let picked: EventResponse | undefined | null;

  const rows = () => Array.from(dialogElement()?.querySelectorAll<HTMLElement>('.row') ?? []);
  const more = () =>
    Array.from(dialogElement()?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === 'Показать ещё',
    );

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideVisibleElements(),
        { provide: CLOCK, useValue: () => Date.UTC(2026, 10, 24, 9, 20) },
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    appRef = TestBed.inject(ApplicationRef);
    backend = TestBed.inject(HttpTestingController);
    picked = null;
    TestBed.inject(DialogService)
      .open<EventResponse>(UpcomingAllDialog)
      .subscribe((r) => (picked = r));
    await appRef.whenStable();
  });

  afterEach(() => backend.verify());

  it('asks for the first page of 20 and shows a skeleton until it comes', () => {
    expect(dialogElement()?.querySelector('[role="status"]')).not.toBeNull();
    backend.expectOne(URL(0));
  });

  it('shows the page; «Показать ещё» asks for the next one and appends it', async () => {
    const first = Array.from({ length: 20 }, (_, i) => event(i + 1));
    backend.expectOne(URL(0)).flush(page(first, 0, true));
    await appRef.whenStable();
    expect(rows()).toHaveLength(20);
    expect(more()).toBeDefined();

    more()!.click();
    await appRef.whenStable();
    const second = Array.from({ length: 10 }, (_, i) => event(i + 21));
    backend.expectOne(URL(1)).flush(page(second, 1, false));
    await appRef.whenStable();

    expect(rows()).toHaveLength(30);
    expect(rows()[29].textContent).toContain('Событие 30');
    expect(more()).toBeUndefined(); // the last page: nothing more to ask
  });

  it('template events are in the list too (E2 gives both kinds)', async () => {
    const fromTemplate = event(2, {
      templateId: 't1',
      templateName: 'Неделя',
      applicationId: 'a1',
    } as never);
    backend.expectOne(URL(0)).flush(page([event(1), fromTemplate], 0, false));
    await appRef.whenStable();
    expect(rows()).toHaveLength(2);
  });

  it('nothing planned: a sentence instead of a blank', async () => {
    backend.expectOne(URL(0)).flush(page([], 0, false));
    await appRef.whenStable();
    expect(dialogElement()?.textContent).toContain('Пока ничего не запланировано.');
  });

  it('an error of the first page: the message and «Повторить» that asks the same page again', async () => {
    backend.expectOne(URL(0)).flush({}, { status: 500, statusText: 'Server Error' });
    await appRef.whenStable();
    expect(dialogElement()?.textContent).toContain('Что-то пошло не так');
    const retry = Array.from(dialogElement()!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Повторить'),
    )!;
    retry.click();
    await appRef.whenStable();
    backend.expectOne(URL(0)).flush(page([event(1)], 0, false));
    await appRef.whenStable();
    expect(rows()).toHaveLength(1);
  });

  it('an error of a next page keeps the rows that are there', async () => {
    backend.expectOne(URL(0)).flush(page([event(1)], 0, true));
    await appRef.whenStable();
    more()!.click();
    await appRef.whenStable();
    backend.expectOne(URL(1)).flush({}, { status: 500, statusText: 'Server Error' });
    await appRef.whenStable();
    expect(rows()).toHaveLength(1);
    expect(dialogElement()?.textContent).toContain('Что-то пошло не так');
  });

  it('a click on a row closes the dialog with that event', async () => {
    backend.expectOne(URL(0)).flush(page([event(1), event(2)], 0, false));
    await appRef.whenStable();
    rows()[1].click();
    await appRef.whenStable();
    expect(picked?.title).toBe('Событие 2');
  });
});
