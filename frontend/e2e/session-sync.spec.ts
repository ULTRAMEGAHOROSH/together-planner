// AUTH-09 on the real backend: two tabs of one browser; signing out in one sends the other to
// /login at once, without a reload and without waiting for a token to expire.
import { expect, test } from './fixtures';
import { loginViaUi } from './helpers/ui';

test('signing out in one tab signs the other tab out', async ({ page, couple, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'the markup does not depend on the width');
  await loginViaUi(page, couple.a);
  const other = await context.newPage();
  await other.goto('/week');
  await expect(other.locator('tp-person-panel')).toHaveCount(2);

  await page.getByRole('button', { name: /^Меню:/ }).click();
  await page.getByRole('menuitem', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login/);

  await expect(other).toHaveURL(/\/login/);
});
