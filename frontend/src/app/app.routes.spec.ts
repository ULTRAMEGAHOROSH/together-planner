import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import { AUTH_RESPONSE, WORKSPACE_CREATED } from '@core/api/models/testing/samples';
import { SessionStore } from '@core/auth/session-store';
import { CLOCK } from '@core/time/zone-clock';
import { devOnly, routes } from './app.routes';

// Thursday 12.11.2026 in Almaty: `/week` always goes to the Monday 09.11.
const NOW = Date.UTC(2026, 10, 12, 9, 20);
const THIS_WEEK = '/week/2026-11-09';
const clock = { provide: CLOCK, useValue: () => NOW };

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
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes, withComponentInputBinding()),
        clock,
      ],
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
    ['/templates', 'Шаблоны недель', 'Шаблоны — Together Planner'],
    ['/templates/new', 'Шаблон', 'Новый шаблон — Together Planner'],
  ])('%s shows its placeholder', async (path, expectedHeading, expectedTitle) => {
    await harness.navigateByUrl(path);
    expect(heading()).toBe(expectedHeading);
    expect(TestBed.inject(Title).getTitle()).toBe(expectedTitle);
  });

  it.each(['/templates', '/templates/new'])(
    '%s opens inside AppShell: header above the page (SHELL-01)',
    async (path) => {
      await harness.navigateByUrl(path);
      const shell = harness.routeNativeElement as HTMLElement;
      expect(shell.tagName.toLowerCase()).toBe('tp-app-shell');
      expect(shell.querySelector('tp-app-header nav')).not.toBeNull();
      expect(shell.querySelector('main h1')).not.toBeNull();
    },
  );

  it('/week/2026-11-16 opens the week page inside AppShell with the title (WEEK-10)', async () => {
    await harness.navigateByUrl('/week/2026-11-16');
    const shell = harness.routeNativeElement as HTMLElement;
    expect(shell.tagName.toLowerCase()).toBe('tp-app-shell');
    expect(shell.querySelector('tp-app-header nav')).not.toBeNull();
    expect(shell.querySelector('main tp-week-page')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Расписание — Together Planner');
    expect(url()).toBe('/week/2026-11-16');
  });

  it('/week → the Monday of the current week; a date in the middle of a week → its Monday', async () => {
    await harness.navigateByUrl('/week');
    expect(url()).toBe(THIS_WEEK);
    await harness.navigateByUrl('/week/2026-11-18');
    await harness.fixture.whenStable(); // the page replaces the address itself
    expect(url()).toBe('/week/2026-11-16');
    await harness.navigateByUrl('/week/no-date');
    await harness.fixture.whenStable();
    expect(url()).toBe(THIS_WEEK);
  });

  it('binds :templateId to the editor input, /templates/new has none', async () => {
    await harness.navigateByUrl('/templates/3f6c2a10-0000-4000-8000-000000000001');
    expect(text()).toContain('3f6c2a10-0000-4000-8000-000000000001');
    await harness.navigateByUrl('/templates/new');
    expect(text()).toContain('Новый шаблон');
  });

  it.each(['/', '/no-such-page'])('%s redirects to the current week', async (path) => {
    await harness.navigateByUrl(path);
    expect(url()).toBe(THIS_WEEK);
    expect(harness.routeNativeElement?.querySelector('tp-week-page')).not.toBeNull();
  });
});

describe('app routes × session (AUTH-06)', () => {
  it.each([
    // The auth page shows its mode from the route data: the button text.
    ['anonymous', '/login', 'Войти', 'Вход — Together Planner'],
    ['anonymous', '/register', 'Создать аккаунт', 'Регистрация — Together Planner'],
    ['no workspace', '/onboarding', 'Общее пространство', 'Общее пространство — Together Planner'],
    // Dev builds only, no sign-in: the board playground (WEEK-05).
    ['anonymous', '/_dev/board', 'Площадка доски', 'Площадка доски — Together Planner'],
  ] as const)('%s: %s shows its placeholder', async (status, path, content, title) => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes, withComponentInputBinding()),
        clock,
      ],
    });
    signIn(status);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path);
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain(content);
    expect(TestBed.inject(Title).getTitle()).toBe(title);
    // The header frame is only for the workspace screens.
    expect(harness.fixture.nativeElement.querySelector('tp-app-header')).toBeNull();
  });

  const login = (returnUrl: string) => `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
  const register = (returnUrl: string) => `/register?returnUrl=${encodeURIComponent(returnUrl)}`;

  it.each<[string, Record<Status, string>]>([
    ['/', { anonymous: '/login', 'no workspace': '/onboarding', workspace: THIS_WEEK }],
    ['/login', { anonymous: '/login', 'no workspace': '/onboarding', workspace: THIS_WEEK }],
    ['/register', { anonymous: '/register', 'no workspace': '/onboarding', workspace: THIS_WEEK }],
    [
      '/join?code=K7QM2XPA',
      {
        anonymous: register('/join?code=K7QM2XPA'),
        'no workspace': '/join?code=K7QM2XPA',
        workspace: '/join?code=K7QM2XPA',
      },
    ],
    [
      '/onboarding',
      { anonymous: login('/onboarding'), 'no workspace': '/onboarding', workspace: THIS_WEEK },
    ],
    ['/week', { anonymous: login('/week'), 'no workspace': '/onboarding', workspace: THIS_WEEK }],
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
      { anonymous: login('/no-such-page'), 'no workspace': '/onboarding', workspace: THIS_WEEK },
    ],
  ])('%s', async (path, expected) => {
    for (const status of ['anonymous', 'no workspace', 'workspace'] as const) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter(routes, withComponentInputBinding()),
          clock,
        ],
      });
      signIn(status);
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(path);
      expect([status, TestBed.inject(Router).url]).toEqual([status, expected[status]]);
    }
  });
});

describe('devOnly (WEEK-05)', () => {
  it('dev routes are kept in a dev build and dropped in production', () => {
    const playground = { path: '_dev/board' };
    expect(devOnly([playground], true)).toEqual([playground]);
    expect(devOnly([playground], false)).toEqual([]);
    // Tests run as a dev build: the playground is registered.
    expect(routes.some((r) => r.path === '_dev/board')).toBe(true);
  });
});
