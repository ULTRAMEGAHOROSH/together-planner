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

// WEEK-15: «Общее свободное время» — gaps in which both are free, on by default.
test('free time: on by default, the toggle removes the green blocks', async ({
  page,
  request,
  couple,
}) => {
  await createEvent(request, couple.a, couple.workspace.id, {
    title: 'Работа',
    description: null,
    start: '2030-03-15T09:00:00',
    end: '2030-03-15T18:00:00',
    participantIds: [couple.a.id],
    category: 'WORK',
    color: null,
  });
  await loginViaUi(page, couple.a);
  await page.goto('/week/2030-03-11?day=2030-03-15');
  const toggle = page.getByRole('button', { name: 'Общее свободное время' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  // The day of the event: 07:00–09:00 and 18:00–23:00, in both panels.
  await expect(page.locator('tp-free-slot')).toHaveCount(4);
  await expect(page.locator('tp-free-slot').first()).toContainText('Оба свободны');
  // It takes no pointer: a click on a free block still reaches the empty place below.
  await page.locator('tp-free-slot').first().click({ force: true });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('tp-free-slot')).toHaveCount(0);
});

// WEEK-17: «за неделю N ч без учёта сна» in the header of each panel.
test('hours of the week in the panel header, sleep left out', async ({
  page,
  request,
  couple,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'a phone shows one day: «за день»');
  const ws = couple.workspace.id;
  await createEvent(request, couple.a, ws, {
    title: 'Работа',
    description: null,
    start: '2030-03-12T09:00:00',
    end: '2030-03-12T18:00:00',
    participantIds: [couple.a.id],
    category: 'WORK',
    color: null,
  });
  await createEvent(request, couple.a, ws, {
    title: 'Сон',
    description: null,
    start: '2030-03-12T23:00:00',
    end: '2030-03-13T07:00:00',
    participantIds: [couple.a.id],
    category: 'SLEEP',
    color: null,
  });
  await loginViaUi(page, couple.a);
  await page.goto('/week/2030-03-11');
  const panels = page.locator('tp-person-panel');
  await expect(panels.nth(0).locator('.stat')).toHaveText('за неделю 9 ч без учёта сна');
  await expect(panels.nth(1).locator('.stat')).toHaveText('за неделю 0 ч без учёта сна');
});
