// UX-02: the screens and dialogs at 375, 768, 1024 and 1440 px. What jsdom cannot see: the page
// must not scroll sideways, and a dialog must sit inside the window. The width is set by the
// spec itself, so one project is enough. With `SHOTS_DIR` set, a screenshot of each is saved.
import { createEvent, createTemplate, registerUser } from './helpers/api';
import { expect, test } from './fixtures';
import { loginViaUi } from './helpers/ui';
import type { Page } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };

const WIDTHS = [375, 768, 1024, 1440] as const;
const SHOTS = process.env['SHOTS_DIR'];

async function noSidewaysScroll(page: Page, label: string) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, `${label}: the page scrolls sideways`).toBeLessThanOrEqual(client);
}

async function shot(page: Page, name: string, width: number) {
  if (SHOTS !== undefined) {
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
}

async function dialogInside(page: Page, label: string) {
  const box = await page.getByRole('dialog').boundingBox();
  const size = page.viewportSize();
  expect(box, `${label}: no dialog`).not.toBeNull();
  expect(box!.x, `${label}: left edge`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${label}: right edge`).toBeLessThanOrEqual(size!.width);
  expect(box!.y, `${label}: top edge`).toBeGreaterThanOrEqual(0);
}

test.describe('responsive (UX-02)', () => {
  test.beforeEach(({ browserName }, info) => {
    test.skip(info.project.name !== 'desktop', 'the spec sets its own widths');
    void browserName;
  });

  for (const width of WIDTHS) {
    test(`signed-out screens · ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 812 });
      for (const path of ['/login', '/register', '/join?code=ABCD1234']) {
        await page.goto(path);
        await expect(page.getByRole('button').first()).toBeVisible();
        await noSidewaysScroll(page, `${path} @${width}`);
        await shot(page, path.replace(/\W+/g, '_'), width);
      }
    });

    test(`onboarding · ${width}px`, async ({ page, request }) => {
      await page.setViewportSize({ width, height: 812 });
      const user = await registerUser(request, 'Новый');
      await page.goto('/login');
      await page.getByLabel('Email').fill(user.email);
      await page.getByLabel('Пароль').fill(user.password);
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await expect(page).toHaveURL(/\/onboarding/);
      await noSidewaysScroll(page, `onboarding @${width}`);
      await shot(page, 'onboarding', width);
    });

    test(`signed-in screens and dialogs · ${width}px`, async ({ page, request, couple }) => {
      const ws = couple.workspace.id;
      const both = [couple.a.id, couple.b.id];
      const longTitle = 'Очень длинное название события без пробелов-Очень-длинное-название';
      await createEvent(request, couple.a, ws, {
        title: longTitle,
        description: null,
        start: '2030-03-15T20:00:00',
        end: '2030-03-15T22:00:00',
        participantIds: both,
        category: 'OTHER',
        color: null,
      });
      const template = await createTemplate(request, couple.a, ws, {
        name: 'Очень длинное название шаблона для проверки переноса строк',
        description: 'Описание',
        events: [
          {
            id: null,
            title: longTitle,
            description: null,
            dayOfWeek: 'MONDAY',
            startTime: '09:00',
            durationMinutes: 60,
            participantIds: both,
            category: 'WORK',
            color: null,
          },
        ],
      });
      await page.setViewportSize({ width, height: 812 });
      await loginViaUi(page, couple.a);

      const screens: [string, string][] = [
        ['week', '/week/2030-03-11'],
        ['calendar', '/calendar?month=2030-03'],
        ['templates', '/templates'],
        ['template-editor', `/templates/${template.id}`],
        ['template-new', '/templates/new'],
        ['settings', '/settings'],
      ];
      for (const [name, path] of screens) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await noSidewaysScroll(page, `${name} @${width}`);
        await shot(page, name, width);
      }

      await page.goto('/week/2030-03-11');
      await page.getByRole('button', { name: 'Новое событие' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await dialogInside(page, `event form @${width}`);
      await noSidewaysScroll(page, `event form page @${width}`);
      await shot(page, 'dialog-event', width);
      await page.keyboard.press('Escape');

      await page.goto('/templates');
      await page.getByRole('button', { name: 'Применить', exact: true }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await dialogInside(page, `apply @${width}`);
      await shot(page, 'dialog-apply', width);
    });
  }
});
