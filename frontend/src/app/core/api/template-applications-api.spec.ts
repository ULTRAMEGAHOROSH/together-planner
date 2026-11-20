import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { TEMPLATE_APPLICATIONS_PAGE, WORKSPACE_FULL_PAIR } from './models/testing/samples';
import { TemplateApplicationsApi } from './template-applications-api';

const WS = WORKSPACE_FULL_PAIR.id;
const HISTORY = `/api/v1/workspaces/${WS}/template-applications`;

describe('TemplateApplicationsApi (T8)', () => {
  let api: TemplateApplicationsApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TemplateApplicationsApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('T8 history: GET …/template-applications?page=&size= (zero-based page)', async () => {
    const result = firstValueFrom(api.history(WS, 0, 20));
    const req = backend.expectOne((r) => r.url === HISTORY);
    expect(req.request.method).toBe('GET');
    expect(req.request.body).toBeNull();
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.keys()).toHaveLength(2);
    req.flush(TEMPLATE_APPLICATIONS_PAGE);
    expect(await result).toEqual(TEMPLATE_APPLICATIONS_PAGE);
  });

  it('uses API_BASE_URL', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.example.test/v1' },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    const result = firstValueFrom(TestBed.inject(TemplateApplicationsApi).history(WS, 1, 5));
    backend
      .expectOne(
        (r) => r.url === `https://api.example.test/v1/workspaces/${WS}/template-applications`,
      )
      .flush(TEMPLATE_APPLICATIONS_PAGE);
    expect(await result).toEqual(TEMPLATE_APPLICATIONS_PAGE);
  });

  it('errors are not handled here: the HTTP error reaches the caller', async () => {
    const result = firstValueFrom(api.history(WS, 0, 20)).catch((error: unknown) => error);
    backend
      .expectOne((r) => r.url === HISTORY)
      .flush(null, { status: 404, statusText: 'Not Found' });
    expect(await result).toMatchObject({ status: 404 });
  });
});
