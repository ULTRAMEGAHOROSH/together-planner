// QA-02: the first meeting, end to end. A registers and creates the workspace, B comes by the
// link in another browser, both see two members, F5 keeps the session, A signs out.
import { expect, test } from '@playwright/test';
import { newCredentials } from './helpers/api';
import { registerViaUi } from './helpers/ui';

test('registration, workspace, joining by the link, reload and sign-out', async ({
  page,
  browser,
}) => {
  const a = newCredentials('Анна');
  const b = newCredentials('Борис');
  const menuOf = (who: string) => `Меню: ${who}`;

  // 1. A registers, creates the workspace and sees the code.
  await page.goto('/register');
  await registerViaUi(page, a);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel('Название').fill(`Дом ${a.email}`);
  await page.getByRole('button', { name: 'Создать и получить код' }).click();
  await expect(page.getByRole('heading', { name: /создано/ })).toBeVisible();
  const code = page.getByLabel('Код приглашения');
  await expect(code).toHaveText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const link = (await page.locator('.link').textContent())?.trim() ?? '';
  expect(link).toContain('/join?code=');

  // 2. B opens the link as a guest: registration first, then the code is waiting.
  const guest = await browser.newContext();
  const pageB = await guest.newPage();
  try {
    await pageB.goto(new URL(link).pathname + new URL(link).search);
    await expect(pageB).toHaveURL(/\/register/);
    await registerViaUi(pageB, b);
    await expect(pageB.getByRole('heading', { name: 'Приглашение в пространство' })).toBeVisible();
    await pageB.getByRole('button', { name: 'Присоединиться' }).click();
    await expect(pageB).toHaveURL(/\/week\//);

    // 3. B sees both members in the header.
    await expect(
      pageB.getByRole('button', { name: menuOf(`${a.displayName} ${b.displayName}`) }),
    ).toBeVisible();

    // 4. A reloads (F5): still signed in, and now sees both.
    await page.getByRole('button', { name: 'К расписанию' }).click();
    await expect(page).toHaveURL(/\/week\//);
    await page.reload();
    await expect(page).toHaveURL(/\/week\//);
    await expect(
      page.getByRole('button', { name: menuOf(`${a.displayName} ${b.displayName}`) }),
    ).toBeVisible();

    // 5. A signs out and lands on the login.
    await page.getByRole('button', { name: menuOf(`${a.displayName} ${b.displayName}`) }).click();
    await page.getByRole('menuitem', { name: 'Выйти' }).click();
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await guest.close();
  }
});
