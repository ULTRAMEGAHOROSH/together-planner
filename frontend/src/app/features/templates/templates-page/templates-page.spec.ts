import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { provideRouter, Router } from '@angular/router';
import {
  AUTH_RESPONSE,
  TEMPLATE_CREATED,
  TEMPLATE_WITH_LAST_APPLICATION,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { ApplyTemplateEntry } from '../apply/apply-entry';
import { TemplatesPage } from './templates-page';

const LIST = `/api/v1/workspaces/${WORKSPACE_FULL_PAIR.id}/templates`;

describe('TemplatesPage (TPL-02)', () => {
  let backend: HttpTestingController;
  let fixture: ComponentFixture<TemplatesPage>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const host = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    backend = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();
  });

  // The journal under the cards asks for its own first page (TPL-10).
  afterEach(() => {
    backend.match((r) => r.url.endsWith('/template-applications'));
    backend.verify();
  });

  it('shows a spinner while the first list loads, then the cards', async () => {
    expect(host().querySelector('.page > tp-spinner')).not.toBeNull();
    backend.expectOne(LIST).flush([TEMPLATE_CREATED, TEMPLATE_WITH_LAST_APPLICATION]);
    await fixture.whenStable();
    expect(host().querySelector('.page > tp-spinner')).toBeNull();
    expect(host().querySelectorAll('tp-template-card')).toHaveLength(2);
    expect(host().querySelector('h1')?.textContent).toBe('Шаблоны недель');
  });

  it('an empty list shows the empty state with «+ Новый шаблон»', async () => {
    backend.expectOne(LIST).flush([]);
    await fixture.whenStable();
    expect(host().querySelector('tp-empty-state')).not.toBeNull();
    expect(host().querySelectorAll('tp-template-card')).toHaveLength(0);
  });

  it('«+ Новый шаблон» goes to /templates/new', async () => {
    backend.expectOne(LIST).flush([]);
    await fixture.whenStable();
    (host().querySelector('.head button:last-of-type') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/templates', 'new']);
  });

  it('«Открыть» goes to /templates/:id', async () => {
    backend.expectOne(LIST).flush([TEMPLATE_CREATED]);
    await fixture.whenStable();
    (host().querySelectorAll('tp-template-card button')[1] as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/templates', TEMPLATE_CREATED.id]);
  });

  it('«Применить» opens the dialog for this template (TPL-08)', async () => {
    const openForTemplate = vi.spyOn(TestBed.inject(ApplyTemplateEntry), 'openForTemplate');
    backend.expectOne(LIST).flush([TEMPLATE_CREATED]);
    await fixture.whenStable();
    (host().querySelectorAll('tp-template-card button')[0] as HTMLButtonElement).click();
    expect(openForTemplate).toHaveBeenCalledWith(TEMPLATE_CREATED.id);
  });

  it('«Сохранить неделю как шаблон» opens the dialog and asks S1 for the current week (TPL-12)', async () => {
    backend.expectOne(LIST).flush([TEMPLATE_CREATED]);
    await fixture.whenStable();
    const save = Array.from(host().querySelectorAll('.head button')).find((b) =>
      b.textContent?.includes('Сохранить неделю как шаблон'),
    ) as HTMLButtonElement;
    save.click();
    await fixture.whenStable();
    const week = backend.expectOne((r) => r.url.endsWith('/week'));
    expect(week.request.params.get('date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TestBed.inject(Dialog).openDialogs).toHaveLength(1);
    TestBed.inject(Dialog).closeAll();
  });

  it('a failed load shows the error with «Повторить», which asks again', async () => {
    backend
      .expectOne(LIST)
      .flush(
        { type: 'about:blank', title: 'x', status: 500, code: 'INTERNAL_ERROR' },
        { status: 500, statusText: 'x' },
      );
    await fixture.whenStable();
    const retry = host().querySelector('tp-error-state button') as HTMLButtonElement;
    expect(retry).not.toBeNull();
    retry.click();
    backend.expectOne(LIST).flush([TEMPLATE_CREATED]);
    await fixture.whenStable();
    expect(host().querySelectorAll('tp-template-card')).toHaveLength(1);
    expect(host().querySelector('tp-error-state')).toBeNull();
  });

  it('deleting a card: two presses, T5 with the version, the card goes after the reload', async () => {
    backend.expectOne(LIST).flush([TEMPLATE_CREATED]);
    await fixture.whenStable();
    const del = () => host().querySelectorAll('tp-template-card button')[2] as HTMLButtonElement;
    del().click();
    await fixture.whenStable();
    del().click();
    const req = backend.expectOne((r) => r.url === `${LIST}/${TEMPLATE_CREATED.id}`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('version')).toBe('0');
    req.flush(null, { status: 204, statusText: 'No Content' });
    backend.expectOne(LIST).flush([]);
    await fixture.whenStable();
    expect(host().querySelectorAll('tp-template-card')).toHaveLength(0);
    expect(host().querySelector('tp-empty-state')).not.toBeNull();
  });
});

describe('TemplatesPage journal (TPL-10)', () => {
  it('the journal stands under the cards and asks T8 with size 20', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace(WORKSPACE_FULL_PAIR);
    const backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TemplatesPage);
    fixture.detectChanges();
    const request = backend.expectOne((r) => r.url.endsWith('/template-applications'));
    expect(request.request.params.get('size')).toBe('20');
    expect(request.request.params.get('page')).toBe('0');
    expect(fixture.nativeElement.querySelector('tp-history-list')).not.toBeNull();
    backend.expectOne(LIST);
  });
});
