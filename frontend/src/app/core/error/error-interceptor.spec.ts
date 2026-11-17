import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, throwError } from 'rxjs';
import {
  PROBLEM_CSRF,
  PROBLEM_INVITE_NOT_FOUND,
  PROBLEM_VALIDATION,
} from '../api/models/testing/samples';
import { ApiError } from './api-error';
import { errorInterceptor, toApiError } from './error-interceptor';

describe('errorInterceptor (FD-65)', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** Sends GET /x, lets `respond` answer it and returns what the subscriber received. */
  async function failWith(respond: (url: string) => void): Promise<unknown> {
    const result = firstValueFrom(http.get('/x')).then(
      () => 'no error',
      (error: unknown) => error,
    );
    respond('/x');
    return result;
  }

  it('ER-01: 400 with errors[] → code, status and fieldErrors grouped by field', async () => {
    const error = await failWith((url) =>
      backend.expectOne(url).flush(PROBLEM_VALIDATION, { status: 400, statusText: 'Bad Request' }),
    );
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect([apiError.code, apiError.status]).toEqual(['VALIDATION_FAILED', 400]);
    expect(apiError.fieldErrors).toEqual({
      email: ['должно иметь формат адреса электронной почты'],
      displayName: ['не должно быть пустым'],
      password: ['размер должен находиться в диапазоне от 8 до 72'],
    });
    expect(apiError.detail).toBe('Invalid request content.');
    expect(apiError.problem).toEqual(PROBLEM_VALIDATION);
  });

  it('ER-02: 409 → code from the body', async () => {
    const problem = {
      title: 'Conflict',
      status: 409,
      detail: 'Version mismatch',
      instance: '/api/v1/workspaces/w/events/e',
      code: 'VERSION_CONFLICT',
    };
    const error = (await failWith((url) =>
      backend.expectOne(url).flush(problem, { status: 409, statusText: 'Conflict' }),
    )) as ApiError;
    expect([error.code, error.status, error.detail]).toEqual([
      'VERSION_CONFLICT',
      409,
      'Version mismatch',
    ]);
    expect(error.fieldErrors).toEqual({});
  });

  it('real 403 / 404 samples keep their codes', async () => {
    const csrf = (await failWith((url) =>
      backend.expectOne(url).flush(PROBLEM_CSRF, { status: 403, statusText: 'Forbidden' }),
    )) as ApiError;
    const invite = (await failWith((url) =>
      backend
        .expectOne(url)
        .flush(PROBLEM_INVITE_NOT_FOUND, { status: 404, statusText: 'Not Found' }),
    )) as ApiError;
    expect([csrf.code, invite.code]).toEqual(['CSRF_HEADER_MISSING', 'INVITE_NOT_FOUND']);
  });

  it('ER-03: status 0 (network) → NETWORK_ERROR with status 0', async () => {
    const error = (await failWith((url) =>
      backend.expectOne(url).error(new ProgressEvent('error')),
    )) as ApiError;
    expect([error.code, error.status, error.problem]).toEqual(['NETWORK_ERROR', 0, null]);
  });

  it('ER-04: 500 without a body → UNKNOWN with the real status', async () => {
    const error = (await failWith((url) =>
      backend.expectOne(url).flush(null, { status: 500, statusText: 'Server Error' }),
    )) as ApiError;
    expect([error.code, error.status, error.problem]).toEqual(['UNKNOWN', 500, null]);
  });

  it('non-ProblemDetail bodies (proxy HTML, unknown code) → UNKNOWN', async () => {
    const html = (await failWith((url) =>
      backend.expectOne(url).flush('<html>Bad Gateway</html>', {
        status: 502,
        statusText: 'Bad Gateway',
      }),
    )) as ApiError;
    expect([html.code, html.status]).toEqual(['UNKNOWN', 502]);
    const newer = (await failWith((url) =>
      backend
        .expectOne(url)
        .flush(
          { status: 418, code: 'SOMETHING_NEW', detail: 'x' },
          { status: 418, statusText: 'x' },
        ),
    )) as ApiError;
    expect([newer.code, newer.status, newer.detail, newer.problem]).toEqual([
      'UNKNOWN',
      418,
      'x',
      null,
    ]);
  });

  it('ignores malformed errors[] items', () => {
    const response = new HttpErrorResponse({
      status: 400,
      error: {
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'end', message: 'a' }, { field: 'end', message: 'b' }, { field: 1 }, 'x'],
      },
    });
    expect(toApiError(response).fieldErrors).toEqual({ end: ['a', 'b'] });
  });

  it('successful responses pass through untouched', async () => {
    const result = firstValueFrom(http.get('/x'));
    backend.expectOne('/x').flush({ ok: true });
    expect(await result).toEqual({ ok: true });
  });

  it('errors that are not HttpErrorResponse pass through unchanged', async () => {
    const bug = new TypeError('bug');
    const result = firstValueFrom(
      TestBed.runInInjectionContext(() =>
        errorInterceptor({} as never, () => throwError(() => bug)),
      ),
    ).catch((error: unknown) => error);
    expect(await result).toBe(bug);
  });
});
