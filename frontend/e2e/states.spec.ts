// UX-01: the audit of «screen × state» on the real backend. Nothing may stay silent: when a
// call fails (500, or the network is gone) the person reads what happened; when a call is slow
// there is a skeleton or a spinner; when there is no data there is a sentence, not a blank.
// Failures are made in the browser (`page.route`), so the real screens run the real code. The
// table of the journal (§12) is this file. One project is enough: the states do not depend on
// the width.
import type { Page, Route } from '@playwright/test';
import { createEvent, createTemplate, registerUser } from './helpers/api';
import { expect, test, type Couple } from './fixtures';
import { loginViaUi } from './helpers/ui';

const SERVER_ERROR = /Ошибка на сервере\. Попробуйте позже\./;
const NO_NETWORK = /Нет связи с сервером\. Проверьте интернет\./;

type Failure = 'server-error' | 'offline';
const FAILURES: readonly Failure[] = ['server-error', 'offline'];
const message = (failure: Failure) => (failure === 'server-error' ? SERVER_ERROR : NO_NETWORK);

/** Breaks the calls whose URL matches (and, if given, whose method matches). */
async function breakCalls(page: Page, url: RegExp, failure: Failure, method?: string) {
  await page.route(url, (route: Route) => {
    if (method !== undefined && route.request().method() !== method) {
      return route.fallback();
    }
    return failure === 'offline'
      ? route.abort('failed')
      : route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 500,
            title: 'Internal Server Error',
            code: 'INTERNAL_ERROR',
          }),
        });
  });
}

/** Holds the matching calls back for `ms`, then lets them go. */
async function slowCalls(page: Page, url: RegExp, ms: number) {
  await page.route(url, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.fallback();
  });
}

const API = '/api/v1/workspaces/[^/]+';
const WEEK_URL = new RegExp(`${API}/week\\?`);
const EVENTS_URL = new RegExp(`${API}/events(\\?|$)`);
const TEMPLATES_URL = new RegExp(`${API}/templates$`);
const APPLICATIONS_URL = new RegExp(`${API}/template-applications`);
const MONTH = '/calendar?month=2030-03';

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'the states do not depend on the width');
});

async function signedIn(page: Page, couple: Couple) {
  await loginViaUi(page, couple.a);
}

test.describe('data screens: a failed call is told, with «Повторить» where there is a retry', () => {
  for (const failure of FAILURES) {
    test(`week · ${failure}`, async ({ page, couple }) => {
      await signedIn(page, couple);
      await breakCalls(page, WEEK_URL, failure);
      await page.goto('/week/2030-03-04');
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      await page.unroute(WEEK_URL);
      await page.getByRole('button', { name: 'Повторить' }).click();
      await expect(page.locator('tp-person-panel')).toHaveCount(2);
    });

    test(`calendar · ${failure}`, async ({ page, couple }) => {
      await signedIn(page, couple);
      await breakCalls(page, EVENTS_URL, failure, 'GET');
      await page.goto(MONTH);
      // The month and the «Запланировано» block each say it.
      await expect(page.getByText(message(failure))).toHaveCount(2);
      await page.unroute(EVENTS_URL);
      await page.getByRole('button', { name: 'Повторить' }).first().click();
      await expect(page.locator('.cell').first()).toBeVisible();
    });

    test(`templates · ${failure}`, async ({ page, couple }) => {
      await signedIn(page, couple);
      await breakCalls(page, TEMPLATES_URL, failure, 'GET');
      await page.goto('/templates');
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      await page.unroute(TEMPLATES_URL);
      await page.getByRole('button', { name: 'Повторить' }).first().click();
      await expect(page.getByText('Шаблонов пока нет').first()).toBeVisible();
    });

    test(`history of applications · ${failure}`, async ({ page, couple }) => {
      await signedIn(page, couple);
      await breakCalls(page, APPLICATIONS_URL, failure);
      await page.goto('/templates');
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      await page.unroute(APPLICATIONS_URL);
      await page.getByRole('button', { name: 'Повторить' }).first().click();
      await expect(page.getByText('Шаблоны ещё не применяли.')).toBeVisible();
    });

    test(`template editor · ${failure}`, async ({ page, request, couple }) => {
      const template = await createTemplate(request, couple.a, couple.workspace.id, {
        name: `Шаблон ${failure}`,
        description: null,
        events: [],
      });
      await signedIn(page, couple);
      const url = new RegExp(`${API}/templates/${template.id}$`);
      await breakCalls(page, url, failure, 'GET');
      await page.goto(`/templates/${template.id}`);
      await expect(page.getByText(message(failure)).first()).toBeVisible();
    });
  }
});

test.describe('actions: a failed save is told in a toast and the work stays', () => {
  for (const failure of FAILURES) {
    test(`sign-in · ${failure}`, async ({ page, couple }) => {
      await breakCalls(page, /\/api\/v1\/auth\/login$/, failure);
      await page.goto('/login');
      await page.getByLabel('Email').fill(couple.a.email);
      await page.getByLabel('Пароль').fill(couple.a.password);
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    });

    test(`registration · ${failure}`, async ({ page }) => {
      await breakCalls(page, /\/api\/v1\/auth\/register$/, failure);
      await page.goto('/register');
      await page.getByLabel('Как вас зовут').fill('Аудит');
      await page.getByLabel('Email').fill(`audit-${failure}@example.test`);
      await page.getByLabel('Пароль').fill('E2e-password-1');
      await page.getByRole('button', { name: 'Создать аккаунт' }).click();
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      await expect(page).toHaveURL(/\/register/);
    });

    test(`creating the workspace · ${failure}`, async ({ page, request }) => {
      const user = await registerUser(request, 'Новичок');
      await page.goto('/login');
      await page.getByLabel('Email').fill(user.email);
      await page.getByLabel('Пароль').fill(user.password);
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await expect(page).toHaveURL(/\/onboarding/);
      await breakCalls(page, new RegExp(`/api/v1/workspaces$`), failure, 'POST');
      await page.getByRole('button', { name: 'Создать и получить код' }).click();
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      await expect(page).toHaveURL(/\/onboarding/);
    });

    test(`joining by the code · ${failure}`, async ({ page, request }) => {
      const user = await registerUser(request, 'Гость');
      await page.goto('/login');
      await page.getByLabel('Email').fill(user.email);
      await page.getByLabel('Пароль').fill(user.password);
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await expect(page).toHaveURL(/\/onboarding/);
      await breakCalls(page, /\/api\/v1\/workspaces\/join$/, failure, 'POST');
      await page.getByLabel('Код приглашения').fill('ABCD-EFGH');
      await page.getByRole('button', { name: 'Присоединиться' }).click();
      await expect(page.getByText(message(failure)).first()).toBeVisible();
    });

    test(`new event · ${failure}`, async ({ page, couple }) => {
      await signedIn(page, couple);
      await page.goto(MONTH);
      await expect(page.locator('.cell').first()).toBeVisible();
      await page.getByRole('button', { name: 'Новое событие' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Название').fill('Не сохранится');
      await breakCalls(page, EVENTS_URL, failure, 'POST');
      await dialog.getByLabel('Название').press('Enter');
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      // The dialog stays open with what was typed.
      await expect(dialog.getByLabel('Название')).toHaveValue('Не сохранится');
    });

    test(`renaming the workspace · ${failure}`, async ({ page, couple }) => {
      await signedIn(page, couple);
      await page.goto('/settings');
      await breakCalls(page, new RegExp(`${API}$`), failure, 'PATCH');
      await page.getByLabel('Название').fill('Новое имя');
      await page.getByRole('button', { name: 'Сохранить' }).click();
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      await expect(page.getByLabel('Название')).toHaveValue('Новое имя');
    });

    test(`sign out everywhere · ${failure}`, async ({ page, couple }) => {
      await signedIn(page, couple);
      await page.goto('/settings');
      await breakCalls(page, /\/api\/v1\/auth\/logout-all$/, failure);
      await page.getByRole('button', { name: 'Выйти на всех устройствах' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Выйти везде' }).click();
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      await expect(page).toHaveURL(/\/settings/);
    });
  }

  test('the session cannot be restored at start-up: the network is told, the sign-in opens', async ({
    page,
    couple,
  }) => {
    await signedIn(page, couple);
    await breakCalls(page, /\/api\/v1\/auth\/refresh$/, 'offline');
    await page.reload();
    await expect(page.getByText(NO_NETWORK).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('templates and events: a failed step is told, the dialog and the typed work stay', () => {
  const oneEventTemplate = (couple: Couple, name: string) => ({
    name,
    description: null,
    events: [
      {
        id: null,
        title: 'Работа',
        description: null,
        dayOfWeek: 'MONDAY' as const,
        startTime: '09:00',
        durationMinutes: 60,
        participantIds: [couple.a.id],
        category: 'WORK' as const,
        color: null,
      },
    ],
  });
  const dialogOf = (page: Page) => page.getByRole('dialog');

  for (const failure of FAILURES) {
    test(`apply · the preview · ${failure}`, async ({ page, request, couple }) => {
      await createTemplate(
        request,
        couple.a,
        couple.workspace.id,
        oneEventTemplate(couple, 'Неделя'),
      );
      await signedIn(page, couple);
      await page.goto('/templates');
      await breakCalls(page, /\/apply\/preview$/, failure, 'POST');
      await page.getByRole('button', { name: 'Применить', exact: true }).first().click();
      await expect(dialogOf(page).getByText(message(failure)).first()).toBeVisible();
    });

    test(`apply · the application · ${failure}`, async ({ page, request, couple }) => {
      await createTemplate(
        request,
        couple.a,
        couple.workspace.id,
        oneEventTemplate(couple, 'Неделя'),
      );
      await signedIn(page, couple);
      await page.goto('/templates');
      await page.getByRole('button', { name: 'Применить', exact: true }).first().click();
      const apply = dialogOf(page).getByRole('button', { name: /^Применить: \+/ });
      await expect(apply).toBeEnabled();
      await breakCalls(page, /\/templates\/[^/]+\/apply$/, failure, 'POST');
      await apply.click();
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      await expect(dialogOf(page)).toBeVisible();
    });

    test(`delete a template · ${failure}`, async ({ page, request, couple }) => {
      await createTemplate(
        request,
        couple.a,
        couple.workspace.id,
        oneEventTemplate(couple, 'Лишний'),
      );
      await signedIn(page, couple);
      await page.goto('/templates');
      await breakCalls(page, new RegExp(`${API}/templates/[^/]+(\\?|$)`), failure, 'DELETE');
      await page.getByRole('button', { name: 'Удалить', exact: true }).first().click();
      await page.getByRole('button', { name: 'Точно удалить?' }).click();
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      await expect(page.getByText('Лишний').first()).toBeVisible();
    });

    test(`change an event · ${failure}`, async ({ page, request, couple }) => {
      await createEvent(request, couple.a, couple.workspace.id, {
        title: 'Кино',
        description: null,
        start: '2030-03-15T20:00:00',
        end: '2030-03-15T22:00:00',
        participantIds: [couple.a.id],
        category: 'OTHER',
        color: null,
      });
      await signedIn(page, couple);
      await page.goto(MONTH);
      await page.locator('.pill', { hasText: 'Кино' }).click();
      const dialog = dialogOf(page);
      await dialog.getByLabel('Название').fill('Кино 2');
      await breakCalls(page, new RegExp(`${API}/events/[^/]+$`), failure, 'PUT');
      await dialog.getByLabel('Название').press('Enter');
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      await expect(dialog.getByLabel('Название')).toHaveValue('Кино 2');
    });

    test(`delete an event · ${failure}`, async ({ page, request, couple }) => {
      await createEvent(request, couple.a, couple.workspace.id, {
        title: 'Лишнее',
        description: null,
        start: '2030-03-15T20:00:00',
        end: '2030-03-15T22:00:00',
        participantIds: [couple.a.id],
        category: 'OTHER',
        color: null,
      });
      await signedIn(page, couple);
      await page.goto(MONTH);
      await page.locator('.pill', { hasText: 'Лишнее' }).click();
      const dialog = dialogOf(page);
      await breakCalls(page, new RegExp(`${API}/events/[^/]+(\\?|$)`), failure, 'DELETE');
      await dialog.getByRole('button', { name: 'Удалить' }).click();
      // The first press asks, the second deletes (EVT-06).
      const again = dialog.getByRole('button', { name: /Точно удалить|Да, удалить/ });
      if (await again.count()) {
        await again.first().click();
      }
      await expect(page.getByText(message(failure)).first()).toBeVisible();
      await expect(dialog).toBeVisible();
    });
  }

  test('an invite link with a code nobody knows: the message, not a silence', async ({
    page,
    request,
  }) => {
    const user = await registerUser(request, 'Гость');
    await page.goto('/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Пароль').fill(user.password);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding/);
    await page.goto('/join?code=ZZZZZZZZ');
    await page.getByRole('button', { name: 'Присоединиться' }).click();
    await expect(page.getByText('Код приглашения не найден. Проверьте его.')).toBeVisible();
  });

  test('a template that was deleted by the partner: the editor says so', async ({
    page,
    request,
    couple,
  }) => {
    const template = await createTemplate(
      request,
      couple.a,
      couple.workspace.id,
      oneEventTemplate(couple, 'Удалят'),
    );
    await signedIn(page, couple);
    await page.goto(`/templates/${template.id}`);
    await expect(page.getByLabel('Название').first()).toBeVisible();
    await page.goto('/templates/00000000-0000-7000-8000-000000000000');
    await expect(page.getByText('Уже удалено партнёром.').first()).toBeVisible();
  });
});

test.describe('empty data: a sentence, not a blank', () => {
  test('a new couple: the week, the templates, the history, «Запланировано»', async ({
    page,
    couple,
  }) => {
    await signedIn(page, couple);
    await page.goto('/week/2030-03-04');
    await expect(page.getByText('На эту неделю пока ничего нет')).toBeVisible();
    await page.goto('/templates');
    await expect(page.getByText('Шаблонов пока нет').first()).toBeVisible();
    await expect(page.getByText('Шаблоны ещё не применяли.')).toBeVisible();
    await page.goto('/calendar');
    await expect(page.getByText('Пока ничего не запланировано.')).toBeVisible();
  });
});

test.describe('slow network: there is a skeleton or a spinner, then the data', () => {
  test('week', async ({ page, couple }) => {
    await signedIn(page, couple);
    await slowCalls(page, WEEK_URL, 2500);
    await page.goto('/week/2030-03-04');
    await expect(page.getByRole('status', { name: 'Загружаем неделю…' })).toBeVisible();
    await expect(page.locator('tp-person-panel')).toHaveCount(2);
  });

  test('calendar', async ({ page, couple }) => {
    await signedIn(page, couple);
    await slowCalls(page, EVENTS_URL, 2500);
    await page.goto(MONTH);
    await expect(page.getByRole('status', { name: 'Загружаем месяц…' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Загружаем события…' })).toBeVisible();
    await expect(page.locator('.cell').first()).toBeVisible();
  });

  test('templates and their history', async ({ page, couple }) => {
    await signedIn(page, couple);
    await slowCalls(page, TEMPLATES_URL, 2500);
    await slowCalls(page, APPLICATIONS_URL, 2500);
    await page.goto('/templates');
    await expect(page.getByRole('status').filter({ hasText: 'Загружаем шаблоны…' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Загружаем журнал…' })).toBeVisible();
    await expect(page.getByText('Шаблонов пока нет').first()).toBeVisible();
  });
});
