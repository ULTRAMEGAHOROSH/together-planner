import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Title } from '@angular/platform-browser';
import { routes } from './app.routes';

describe('app routes (FND-05 skeleton)', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes, withComponentInputBinding())],
    });
    harness = await RouterTestingHarness.create();
  });

  const heading = () =>
    (harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent;
  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';
  const url = () => TestBed.inject(Router).url;

  it.each([
    ['/login', 'Вход и регистрация', 'Вход — Together Planner'],
    ['/register', 'Вход и регистрация', 'Регистрация — Together Planner'],
    ['/join?code=K7QM2XPA', 'Приглашение в пространство', 'Приглашение — Together Planner'],
    ['/onboarding', 'Общее пространство', 'Общее пространство — Together Planner'],
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
