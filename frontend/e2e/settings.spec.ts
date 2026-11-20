// SET-01: settings on the real backend (W3): the page opens from the user menu, the profile is
// only shown, the workspace can be renamed and the new name stays after a reload.
import { expect, test } from './fixtures';
import { loginViaUi } from './helpers/ui';

test.describe('settings (SET-01)', () => {
  test('from the menu: the profile as text, the members, a rename that survives a reload', async ({
    page,
    couple,
  }, info) => {
    await loginViaUi(page, couple.a);
    await page.getByRole('button', { name: /^Меню:/ }).click();
    await page.getByRole('menuitem', { name: 'Настройки' }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Настройки' })).toBeVisible();

    const profile = page.locator('[aria-labelledby="settings-profile"]');
    await expect(profile).toContainText(couple.a.email);
    await expect(profile.locator('input')).toHaveCount(0);

    const members = page.locator('.members .member');
    await expect(members).toHaveCount(2);
    await expect(members.nth(0)).toContainText('Создатель');
    await expect(members.nth(1)).toContainText('Участник');
    await expect(page.locator('tp-invite-card')).toHaveCount(0); // both are in

    const name = page.getByLabel('Название');
    const save = page.getByRole('button', { name: 'Сохранить' });
    await expect(save).toBeDisabled();
    await name.fill('Наш дом');
    await save.click();
    await expect(page.getByText('Название сохранено').first()).toBeVisible();
    // The header shows the name on a wide screen (it gives its place to the tabs on a phone).
    if (info.project.name === 'desktop') {
      await expect(page.locator('.workspace-name')).toHaveText('Наш дом');
    }

    await page.reload();
    await expect(name).toHaveValue('Наш дом');
  });

  test('the partner sees the new name too', async ({ page, couple, browser }, info) => {
    await loginViaUi(page, couple.a);
    await page.goto('/settings');
    await page.getByLabel('Название').fill('Общий дом');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByText('Название сохранено').first()).toBeVisible();

    const context = await browser.newContext({ baseURL: info.project.use.baseURL });
    const other = await context.newPage();
    await loginViaUi(other, couple.b);
    await other.goto('/settings');
    await expect(other.getByLabel('Название')).toHaveValue('Общий дом');
    await context.close();
  });

  // SET-02: A5 on the real backend: the refresh tokens of every device are revoked.
  test('sign out everywhere: the other device is out after its next refresh', async ({
    page,
    couple,
    browser,
  }, info) => {
    const context = await browser.newContext({ baseURL: info.project.use.baseURL });
    const other = await context.newPage();
    await loginViaUi(other, couple.a);
    await expect(other.locator('tp-person-panel')).toHaveCount(2);

    await loginViaUi(page, couple.a);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Выйти на всех устройствах' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('до 15 минут');
    // Cancel first: nothing happens.
    await dialog.getByRole('button', { name: 'Отмена' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/settings$/);

    await page.getByRole('button', { name: 'Выйти на всех устройствах' }).click();
    await dialog.getByRole('button', { name: 'Выйти везде' }).click();
    await expect(page).toHaveURL(/\/login/);

    // The other device lives on its access token until it needs a new one: a reload does.
    await other.reload();
    await expect(other).toHaveURL(/\/login/);
    await context.close();
  });
});
