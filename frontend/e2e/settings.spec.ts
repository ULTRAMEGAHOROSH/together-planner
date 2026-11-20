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
});
