// UX-04: the week changes without a flash. While the next week is loading the board stays on
// screen (no blank, no skeleton in its place); a dialog opens with the prototype's animation.
import { expect, test } from './fixtures';
import { loginViaUi } from './helpers/ui';

test.describe('motion (UX-04)', () => {
  test('week to week: the panels never vanish while the next week loads', async ({
    page,
    couple,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'the markup does not depend on the width');
    await loginViaUi(page, couple.a);
    await expect(page.locator('tp-person-panel')).toHaveCount(2);
    // A slow answer makes any flash long enough to see.
    await page.route(/\/workspaces\/[^/]+\/week\?/, async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.continue();
    });
    await page.evaluate(() => {
      const w = window as unknown as { __min: number; __skeleton: boolean };
      w.__min = 99;
      w.__skeleton = false;
      new MutationObserver(() => {
        w.__min = Math.min(w.__min, document.querySelectorAll('tp-person-panel').length);
        if (document.querySelector('main [role="status"][aria-label]')) w.__skeleton = true;
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.getByRole('button', { name: 'Следующая неделя' }).click();
    await expect(page).toHaveURL(/\/week\/\d{4}-\d{2}-\d{2}$/);
    await page.waitForTimeout(1500);
    const seen = await page.evaluate(() => {
      const w = window as unknown as { __min: number; __skeleton: boolean };
      return { min: w.__min, skeleton: w.__skeleton };
    });
    expect(seen.min, 'the panels disappeared during the switch').toBe(2);
    expect(seen.skeleton, 'a skeleton replaced the board').toBe(false);
  });

  test('a dialog opens with tpIn and a backdrop with tpFade, as in the prototype', async ({
    page,
    couple,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'the markup does not depend on the width');
    await loginViaUi(page, couple.a);
    await page.getByRole('button', { name: 'Новое событие' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const names = await page.evaluate(() => ({
      dialog: getComputedStyle(document.querySelector('.cdk-dialog-container')!).animationName,
      backdrop: getComputedStyle(document.querySelector('.tp-dialog-backdrop')!).animationName,
      dialogTime: getComputedStyle(document.querySelector('.cdk-dialog-container')!)
        .animationDuration,
    }));
    expect(names).toEqual({ dialog: 'tpIn', backdrop: 'tpFade', dialogTime: '0.2s' });
  });
});
