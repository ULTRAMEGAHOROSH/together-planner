// WEEK-14 on the real backend: the pointer on one copy of a joint event rings both copies; the
// hover card appears beside the card, does not take the pointer, and goes when the pointer leaves.
import { createEvent } from './helpers/api';
import { expect, test } from './fixtures';
import { loginViaUi } from './helpers/ui';

test('hover on a joint event: both copies are ringed, the hover card shows beside it', async ({
  page,
  request,
  couple,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'there is no hover on a phone');
  await createEvent(request, couple.a, couple.workspace.id, {
    title: 'Ужин вдвоём',
    description: 'столик у окна',
    start: '2030-03-15T19:00:00',
    end: '2030-03-15T21:00:00',
    participantIds: [couple.a.id, couple.b.id],
    category: 'FOOD',
    color: null,
  });
  await createEvent(request, couple.a, couple.workspace.id, {
    title: 'Один',
    description: null,
    start: '2030-03-15T10:00:00',
    end: '2030-03-15T11:00:00',
    participantIds: [couple.a.id],
    category: 'WORK',
    color: null,
  });
  await loginViaUi(page, couple.a);
  await page.goto('/week/2030-03-11');
  const copies = page.locator('tp-event-card', { hasText: 'Ужин вдвоём' });
  await expect(copies).toHaveCount(2);

  await copies.first().scrollIntoViewIfNeeded();
  await copies.first().hover();
  await expect(copies.first()).toHaveClass(/highlighted/);
  await expect(copies.nth(1)).toHaveClass(/highlighted/); // the copy in the other panel
  await expect(page.locator('tp-event-card', { hasText: 'Один' })).not.toHaveClass(/highlighted/);

  const card = page.locator('tp-event-hovercard');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Ужин вдвоём');
  await expect(card).toContainText('столик у окна');
  await expect(card).toContainText('Нажмите, чтобы изменить');
  // It does not take the pointer: the card under the cursor is still the card.
  expect(
    await card.evaluate((e) => getComputedStyle(e.closest('.cdk-overlay-pane')!).pointerEvents),
  ).toBe('none');
  const cardBox = (await card.boundingBox())!;
  const copyBox = (await copies.first().boundingBox())!;
  const overlapsCopy =
    cardBox.x < copyBox.x + copyBox.width &&
    cardBox.x + cardBox.width > copyBox.x &&
    cardBox.y < copyBox.y + copyBox.height &&
    cardBox.y + cardBox.height > copyBox.y;
  expect(overlapsCopy, 'the hover card covers the card under the pointer').toBe(false);

  await page.mouse.move(5, 300);
  await expect(card).toHaveCount(0);
  await expect(copies.first()).not.toHaveClass(/highlighted/);
  await expect(copies.nth(1)).not.toHaveClass(/highlighted/);
});
