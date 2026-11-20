import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
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

  afterEach(() => backend.verify());

  it('shows a spinner while the first list loads, then the cards', async () => {
    expect(host().querySelector('tp-spinner')).not.toBeNull();
    backend.expectOne(LIST).flush([TEMPLATE_CREATED, TEMPLATE_WITH_LAST_APPLICATION]);
    await fixture.whenStable();
    expect(host().querySelector('tp-spinner')).toBeNull();
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
    (host().querySelector('.head button') as HTMLButtonElement).click();
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
