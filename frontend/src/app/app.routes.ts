import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import {
  authGuard,
  guestGuard,
  inviteeGuard,
  noWorkspaceGuard,
  workspaceGuard,
} from '@core/auth/guards';
import { unsavedChangesGuard } from '@core/navigation/unsaved-changes-guard';
import { currentWeekPath } from '@features/schedule';

/** Routes that exist only in a dev build (`ng serve`, tests): in production they are absent. */
export function devOnly(devRoutes: Routes, dev = isDevMode()): Routes {
  return dev ? devRoutes : [];
}

// Route map: docs/frontend-final-decisions.md §6. Every page is lazy (FD-45).
// Not wired yet: calendar/settings (P1).
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
    canActivate: [inviteeGuard],
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
  // The board playground on fixtures: dev builds only, no sign-in (WEEK-05).
  ...devOnly([
    {
      path: '_dev/board',
      title: 'Площадка доски — Together Planner',
      loadComponent: () =>
        import('@features/schedule/dev/board-playground').then((m) => m.BoardPlayground),
    },
  ]),
  {
    // The app itself: signed in and with a workspace, inside the header frame (SHELL-01).
    path: '',
    canMatch: [authGuard, workspaceGuard],
    loadComponent: () => import('@layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        // /week → the Monday of the current week in the workspace zone (WEEK-10).
        path: 'week',
        pathMatch: 'full',
        redirectTo: currentWeekPath,
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
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/templates/template-editor-page/template-editor-page').then(
            (m) => m.TemplateEditorPage,
          ),
      },
      {
        path: 'templates/:templateId',
        title: 'Шаблон — Together Planner',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/templates/template-editor-page/template-editor-page').then(
            (m) => m.TemplateEditorPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'week' },
];
