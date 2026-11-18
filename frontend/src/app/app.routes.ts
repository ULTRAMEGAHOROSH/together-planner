import { Routes } from '@angular/router';
import { authGuard, guestGuard, noWorkspaceGuard, workspaceGuard } from '@core/auth/guards';

// Route map: docs/frontend-final-decisions.md §6. Every page is lazy (FD-45).
// Not wired yet: AppShell component on the app parent (SHELL-01), `week` redirect
// to the current Monday (WEEK-10), calendar/settings (P1), /_dev/board (WEEK-05).
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'week' },
  {
    path: 'login',
    canActivate: [guestGuard],
    data: { mode: 'login' },
    title: 'Вход — Together Planner',
    loadComponent: () => import('@features/auth/auth-page/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    data: { mode: 'register' },
    title: 'Регистрация — Together Planner',
    loadComponent: () => import('@features/auth/auth-page/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'join',
    title: 'Приглашение — Together Planner',
    loadComponent: () =>
      import('@features/onboarding/join-link-page/join-link-page').then((m) => m.JoinLinkPage),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard, noWorkspaceGuard],
    title: 'Общее пространство — Together Planner',
    loadComponent: () =>
      import('@features/onboarding/onboarding-page/onboarding-page').then((m) => m.OnboardingPage),
  },
  {
    // The app itself: signed in and with a workspace. AppShell becomes its component (SHELL-01).
    path: '',
    canMatch: [authGuard, workspaceGuard],
    children: [
      {
        // Temporary: becomes a redirect to /week/<current Monday> in WEEK-10.
        path: 'week',
        pathMatch: 'full',
        title: 'Расписание — Together Planner',
        loadComponent: () =>
          import('@features/schedule/week-page/week-page').then((m) => m.WeekPage),
      },
      {
        path: 'week/:weekStart',
        title: 'Расписание — Together Planner',
        loadComponent: () =>
          import('@features/schedule/week-page/week-page').then((m) => m.WeekPage),
      },
      {
        path: 'templates',
        title: 'Шаблоны — Together Planner',
        loadComponent: () =>
          import('@features/templates/templates-page/templates-page').then((m) => m.TemplatesPage),
      },
      {
        path: 'templates/new',
        title: 'Новый шаблон — Together Planner',
        loadComponent: () =>
          import('@features/templates/template-editor-page/template-editor-page').then(
            (m) => m.TemplateEditorPage,
          ),
      },
      {
        path: 'templates/:templateId',
        title: 'Шаблон — Together Planner',
        loadComponent: () =>
          import('@features/templates/template-editor-page/template-editor-page').then(
            (m) => m.TemplateEditorPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'week' },
];
