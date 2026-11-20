// CAL-01: the month on the real backend (E1). A month far from «now» keeps the test free of
// the date: 2030-03 starts on a Friday, its grid is five weeks (Mon 25.02 … Sun 31.03).
import { createEvent } from './helpers/api';
import { expect, test } from './fixtures';
import { loginViaUi } from './helpers/ui';

const body = (title: string, start: string, end: string, ids: string[]) => ({
  title,
  description: null,
  start,
  end,
  participantIds: ids,
  category: 'OTHER' as const,
  color: null,
});

test.describe('calendar (CAL-01)', () => {
  test('events are in their days, a day opens its week, a pill opens the event', async ({
    page,
    request,
    couple,
  }) => {
    const ws = couple.workspace.id;
    const both = [couple.a.id, couple.b.id];
    await createEvent(
      request,
      couple.a,
      ws,
      body('Кино', '2030-03-15T20:00:00', '2030-03-15T22:00:00', both),
    );
    // Four on one day: three pills and «+ ещё 1».
    for (const [i, title] of ['Раз', 'Два', 'Три', 'Четыре'].entries()) {
      await createEvent(
        request,
        couple.a,
        ws,
        body(title, `2030-03-20T0${i + 6}:00:00`, `2030-03-20T0${i + 6}:30:00`, [couple.a.id]),
      );
    }

    await loginViaUi(page, couple.a);
    await page.goto('/calendar?month=2030-03');
    await expect(page.getByRole('heading', { name: 'Март 2030' })).toBeVisible();
    await expect(page.locator('.cell')).toHaveCount(35);

    const march15 = page.locator('.cell', {
      has: page.getByLabel('Открыть неделю: пятница, 15 марта'),
    });
    await expect(march15.locator('.pill')).toHaveText(/Кино/);
    const march20 = page.locator('.cell', {
      has: page.getByLabel('Открыть неделю: среда, 20 марта'),
    });
    await expect(march20.locator('.pill')).toHaveCount(3);
    await expect(march20.locator('.more')).toHaveText('+ ещё 1');

    // A pill opens the editor of that event, on the calendar.
    await march15.locator('.pill').click();
    await expect(page.getByRole('dialog').getByLabel('Название')).toHaveValue('Кино');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/calendar\?month=2030-03$/);

    // Months by the arrows.
    await page.getByRole('button', { name: 'Следующий месяц' }).click();
    await expect(page.getByRole('heading', { name: 'Апрель 2030' })).toBeVisible();
    await expect(page).toHaveURL(/month=2030-04$/);
    await page.getByRole('button', { name: 'Предыдущий месяц' }).click();
    await expect(page.getByRole('heading', { name: 'Март 2030' })).toBeVisible();

    // A day leads to that day on its week (a cell without pills: on the phone a pill covers the cell).
    await page.getByLabel('Открыть неделю: четверг, 14 марта').click();
    await expect(page).toHaveURL(/\/week\/2030-03-11\?day=2030-03-14$/);
    await expect(page.locator('tp-person-panel')).toHaveCount(2);
  });

  test('an event made on the calendar shows up in its cell', async ({ page, couple }) => {
    await loginViaUi(page, couple.a);
    await page.goto('/calendar?month=2030-03');
    await expect(page.locator('.cell')).toHaveCount(35);
    await page.getByRole('button', { name: 'Новое событие' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Название').fill('Новоселье');
    await dialog.getByLabel('Название').press('Enter');
    await expect(dialog).toBeHidden();
    // The header's «+ Событие» starts on the 1st of a month that is not the current one.
    const first = page.locator('.cell', {
      has: page.getByLabel('Открыть неделю: пятница, 1 марта'),
    });
    await expect(first.locator('.pill')).toHaveText(/Новоселье/);
  });
});
