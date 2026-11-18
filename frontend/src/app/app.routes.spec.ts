import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import { AUTH_RESPONSE, WORKSPACE_CREATED } from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { routes } from './app.routes';

type Status = 'anonymous' | 'no workspace' | 'workspace';

function signIn(status: Status) {
  const session = TestBed.inject(SessionStore);
  if (status === 'anonymous') return session.clear();
  session.setAuth(AUTH_RESPONSE);
  if (status === 'workspace') session.setWorkspace(WORKSPACE_CREATED);
}

describe('app routes (FND-05 skeleton)', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes, withComponentInputBinding())],
    });
    // Guests only reach the auth pages; the placeholders are checked as a full member.
    signIn('workspace');
    harness = await RouterTestingHarness.create();
  });

  const heading = () =>
    (harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent;
  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';
  const url = () => TestBed.inject(Router).url;

  it.each([
    ['/join?code=K7QM2XPA', 'Приглашение в пространство', 'Приглашение — Together Planner'],
    ['/week', 'Расписание', 'Расписание — Together Planner'],
    ['/templates', 'Шаблоны недель', 'Шаблоны — Together Planner'],
    ['/templates/new', 'Шаблон', 'Новый шаблон — Together Planner'],
  ])('%s shows its placeholder', async (path, expectedHeading, expectedTitle) => {
    await harness.navigateByUrl(path);
    expect(heading()).toBe(expectedHeading);
    expect(TestBed.inject(Title).getTitle()).toBe(expectedTitle);
  });

  it('binds :weekStart to the WeekPage input', async () => {
    await harness.navigateByUrl('/week/2026-11-16');
    expect(text()).toContain('Неделя с 2026-11-16');
  });

  it('binds :templateId to the editor input, /templates/new has none', async () => {
    await harness.navigateByUrl('/templates/3f6c2a10-0000-4000-8000-000000000001');
    expect(text()).toContain('3f6c2a10-0000-4000-8000-000000000001');
    await harness.navigateByUrl('/templates/new');
    expect(text()).toContain('Новый шаблон');
  });

  it.each(['/', '/no-such-page'])('%s redirects to /week', async (path) => {
    await harness.navigateByUrl(path);
    expect(url()).toBe('/week');
    expect(heading()).toBe('Расписание');
  });
});

describe('app routes × session (AUTH-06)', () => {
  it.each([
    ['anonymous', '/login', 'Вход и регистрация', 'Вход — Together Planner'],
    ['anonymous', '/register', 'Вход и регистрация', 'Регистрация — Together Planner'],
    ['no workspace', '/onboarding', 'Общее пространство', 'Общее пространство — Together Planner'],
  ] as const)('%s: %s shows its placeholder', async (status, path, heading, title) => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    signIn(status);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path);
    expect((harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent).toBe(
      heading,
    );
    expect(TestBed.inject(Title).getTitle()).toBe(title);
  });

  const login = (returnUrl: string) => `/login?returnUrl=${encodeURIComponent(returnUrl)}`;

  it.each<[string, Record<Status, string>]>([
    ['/', { anonymous: '/login', 'no workspace': '/onboarding', workspace: '/week' }],
    ['/login', { anonymous: '/login', 'no workspace': '/onboarding', workspace: '/week' }],
    ['/register', { anonymous: '/register', 'no workspace': '/onboarding', workspace: '/week' }],
    [
      '/join?code=K7QM2XPA',
      {
        anonymous: '/join?code=K7QM2XPA',
        'no workspace': '/join?code=K7QM2XPA',
        workspace: '/join?code=K7QM2XPA',
      },
    ],
    [
      '/onboarding',
      { anonymous: login('/onboarding'), 'no workspace': '/onboarding', workspace: '/week' },
    ],
    ['/week', { anonymous: login('/week'), 'no workspace': '/onboarding', workspace: '/week' }],
    [
      '/week/2026-11-16?day=2026-11-18',
      {
        anonymous: login('/week/2026-11-16?day=2026-11-18'),
        'no workspace': '/onboarding',
        workspace: '/week/2026-11-16?day=2026-11-18',
      },
    ],
    [
      '/templates/new',
      {
        anonymous: login('/templates/new'),
        'no workspace': '/onboarding',
        workspace: '/templates/new',
      },
    ],
    [
      '/no-such-page',
      { anonymous: login('/no-such-page'), 'no workspace': '/onboarding', workspace: '/week' },
    ],
  ])('%s', async (path, expected) => {
    for (const status of ['anonymous', 'no workspace', 'workspace'] as const) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
      signIn(status);
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(path);
      expect([status, TestBed.inject(Router).url]).toEqual([status, expected[status]]);
    }
  });
});
