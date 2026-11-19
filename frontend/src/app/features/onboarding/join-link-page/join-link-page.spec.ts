import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  AUTH_RESPONSE,
  WORKSPACE_CREATED,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import { authInterceptor } from '@core/auth/auth-interceptor';
import { SessionStore } from '@core/auth/session-store';
import { errorInterceptor } from '@core/error/error-interceptor';
import { JoinLinkPage } from './join-link-page';

@Component({ template: 'week' })
class Week {}

describe('JoinLinkPage', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let session: SessionStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter(
          [
            { path: 'join', component: JoinLinkPage },
            { path: 'week', component: Week },
          ],
          withComponentInputBinding(),
        ),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => backend.verify());

  const page = () => harness.routeNativeElement as HTMLElement;
  const text = (selector: string) => page().querySelector(selector)?.textContent?.trim() ?? null;
  const codeInput = () => page().querySelector<HTMLInputElement>('tp-join-workspace-form input');
  const button = (label: string) =>
    Array.from(page().querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const url = () => TestBed.inject(Router).url;

  it('without a workspace: the join form with the code from the link, nothing sent yet', async () => {
    await harness.navigateByUrl('/join?code=K7QM2XPA');
    expect(text('h1')).toBe('Приглашение в пространство');
    expect(text('.lead')).toBe(
      'Партнёр прислал вам код. Проверьте его и нажмите «Присоединиться».',
    );
    expect(codeInput()?.value).toBe('K7QM2XPA');
    backend.expectNone('/api/v1/workspaces/join');

    button('Присоединиться')!.click();
    await harness.fixture.whenStable();
    const req = backend.expectOne('/api/v1/workspaces/join');
    expect(req.request.body).toEqual({ code: 'K7QM2XPA' });
    req.flush(WORKSPACE_FULL_PAIR);
    await harness.fixture.whenStable();
    expect(session.workspace()).toEqual(WORKSPACE_FULL_PAIR);
    expect(url()).toBe('/week');
  });

  it('a link without a code: the empty form', async () => {
    await harness.navigateByUrl('/join');
    expect(codeInput()?.value).toBe('');
  });

  it('already in a workspace: a message with its name and «К расписанию», no form', async () => {
    session.setWorkspace(WORKSPACE_CREATED);
    await harness.navigateByUrl('/join?code=K7QM2XPA');
    expect(text('h1')).toBe('Приглашение в пространство');
    expect(text('.lead')).toContain('Вы уже в пространстве «Мы».');
    expect(codeInput()).toBeNull();
    button('К расписанию')!.click();
    await harness.fixture.whenStable();
    expect(url()).toBe('/week');
  });
});
