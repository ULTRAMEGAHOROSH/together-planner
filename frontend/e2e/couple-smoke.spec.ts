// QA-01: the `couple` fixture works — two users in one workspace, and the week shows both.
import { expect, test } from './fixtures';
import { loginViaUi } from './helpers/ui';

test('a couple opens the week with two members', async ({ page, couple }) => {
  await loginViaUi(page, couple.a);
  const panels = page.locator('tp-person-panel');
  await expect(panels).toHaveCount(2);
  await expect(panels.nth(0)).toHaveAttribute('aria-label', couple.a.displayName);
  await expect(panels.nth(1)).toHaveAttribute('aria-label', couple.b.displayName);
  const bySeat = [...couple.workspace.members].sort((x, y) => x.seat - y.seat);
  expect(bySeat.map((m) => m.userId)).toEqual([couple.a.id, couple.b.id]);
});
