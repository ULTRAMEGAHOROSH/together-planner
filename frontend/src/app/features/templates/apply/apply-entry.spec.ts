import { Dialog } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  AUTH_RESPONSE,
  TEMPLATE_CREATED,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ToastService } from '@core/notify/toast-service';
import { CLOCK } from '@core/time/zone-clock';
import { provideVisibleElements } from '@shared/ui/dialog/testing';
import { ApplyTemplateEntry, NO_TEMPLATES_TEXT } from './apply-entry';
import type { ApplyTemplateDialog } from './apply-dialog/apply-dialog';

const LIST = `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/templates`;
// Thursday 19.11.2026 in Almaty: this week starts on 16.11, the next on 23.11.
const NOW = Date.UTC(2026, 10, 19, 9, 20);

const OTHER = { ...TEMPLATE_CREATED, id: 'other-id', name: 'Отпуск' };

describe('ApplyTemplateEntry (TPL-08)', () => {
  let backend: HttpTestingController;
  let entry: ApplyTemplateEntry;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideVisibleElements(),
        provideRouter([]),
        { provide: CLOCK, useValue: () => NOW },
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    backend = TestBed.inject(HttpTestingController);
    entry = TestBed.inject(ApplyTemplateEntry);
    appRef = TestBed.inject(ApplicationRef);
  });

  afterEach(() => {
    backend.match((r) => r.url.endsWith('/apply/preview'));
    backend.verify();
  });

  const dialog = () =>
    TestBed.inject(Dialog).openDialogs[0]?.componentInstance as ApplyTemplateDialog | undefined;

  it('from the schedule: the week on screen and the first template', async () => {
    entry.openForWeek('2026-11-30');
    backend.expectOne(LIST).flush([TEMPLATE_CREATED]);
    await appRef.whenStable();
    // The dialog loads its own list.
    backend.expectOne(LIST).flush([TEMPLATE_CREATED]);
    await appRef.whenStable();
    expect(dialog()?.weekStart()).toBe('2026-11-30');
    expect(dialog()?.templateId()).toBe(TEMPLATE_CREATED.id);
  });

  it('from the schedule without templates: a toast with «Создать», no dialog', async () => {
    const show = vi.spyOn(TestBed.inject(ToastService), 'show');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    entry.openForWeek('2026-11-16');
    backend.expectOne(LIST).flush([]);
    await appRef.whenStable();
    expect(dialog()).toBeUndefined();
    expect(show).toHaveBeenCalledTimes(1);
    const [text, options] = show.mock.calls[0];
    expect(text).toBe(NO_TEMPLATES_TEXT);
    options?.action?.run();
    expect(navigate).toHaveBeenCalledWith(['/templates', 'new']);
  });

  it('a failed list shows the error and opens nothing', async () => {
    const error = vi.spyOn(TestBed.inject(ToastService), 'error');
    entry.openForWeek('2026-11-16');
    backend.expectOne(LIST).flush(null, { status: 500, statusText: 'Server Error' });
    await appRef.whenStable();
    expect(error).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeUndefined();
  });

  it('from a template: this template and the next week (by the clock of the workspace)', async () => {
    entry.openForTemplate(TEMPLATE_CREATED.id);
    await appRef.whenStable();
    backend.expectOne(LIST).flush([OTHER, TEMPLATE_CREATED]);
    await appRef.whenStable();
    expect(dialog()?.templateId()).toBe(TEMPLATE_CREATED.id);
    expect(dialog()?.weekStart()).toBe('2026-11-23');
  });
});
