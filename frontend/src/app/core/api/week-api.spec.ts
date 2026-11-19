import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { WEEK, WORKSPACE_FULL_PAIR } from './models/testing/samples';
import { WeekApi } from './week-api';

const WS = WORKSPACE_FULL_PAIR.id;

describe('WeekApi (S1)', () => {
  let api: WeekApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(WeekApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('GET /workspaces/{wsId}/week?date= returns the week as is', async () => {
    const result = firstValueFrom(api.get(WS, '2026-11-25'));
    const req = backend.expectOne(`/api/v1/workspaces/${WS}/week?date=2026-11-25`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.keys()).toEqual([]);
    req.flush(WEEK);
    expect(await result).toEqual(WEEK);
  });

  it('without a date there is no query: the backend takes the current week', async () => {
    const result = firstValueFrom(api.get(WS));
    const req = backend.expectOne(`/api/v1/workspaces/${WS}/week`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush(WEEK);
    expect(await result).toEqual(WEEK);
  });
});
