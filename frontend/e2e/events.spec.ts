// QA-03: events on the real backend (S1, E3–E6): who sees what, events across midnight and
// across weeks, moving and deleting, and the version conflict. Every test has its own couple.
// The days are opened one by one (`?day=`): the same check holds on the phone, where the week
// is not offered. The week is far from «now», so the tests do not depend on the date.
import type { Page } from '@playwright/test';
import { createEvent, updateEvent } from './helpers/api';
import { expect, test, type Couple } from './fixtures';
import { loginViaUi } from './helpers/ui';

const WEEK = '2030-03-04'; // a Monday
const NEXT_WEEK = '2030-03-11';
const at = (date: string, time: string) => `${date}T${time}:00`;

async function showDay(page: Page, weekStart: string, day: string) {
  await page.goto(`/week/${weekStart}?day=${day}`);
  await expect(page.locator('tp-person-panel')).toHaveCount(2);
}
/** Cards of a panel (0 — the creator, 1 — the partner) with the title in their name. */
const cards = (page: Page, panel: number, title: string) =>
  page.locator('tp-person-panel').nth(panel).locator('tp-event-card button', { hasText: title });

function event(
  couple: Couple,
  patch: { title: string; start: string; end: string; who: 'a' | 'b' | 'both' },
) {
  const ids = { a: [couple.a.id], b: [couple.b.id], both: [couple.a.id, couple.b.id] }[patch.who];
  return {
    title: patch.title,
    description: null,
    start: patch.start,
    end: patch.end,
    participantIds: ids,
    category: 'OTHER' as const,
    color: null,
  };
}

test.describe('events (QA-03)', () => {
  test('a shared event is in both panels, a single one only in its own', async ({
    page,
    request,
    couple,
  }) => {
    const ws = couple.workspace.id;
    await createEvent(
      request,
      couple.a,
      ws,
      event(couple, {
        title: 'Ужин',
        start: at('2030-03-05', '19:00'),
        end: at('2030-03-05', '20:30'),
        who: 'both',
      }),
    );
    await createEvent(
      request,
      couple.a,
      ws,
      event(couple, {
        title: 'Бассейн',
        start: at('2030-03-05', '08:00'),
        end: at('2030-03-05', '09:00'),
        who: 'a',
      }),
    );
    await loginViaUi(page, couple.a);
    await showDay(page, WEEK, '2030-03-05');
    await expect(cards(page, 0, 'Ужин')).toHaveCount(1);
    await expect(cards(page, 1, 'Ужин')).toHaveCount(1);
    await expect(cards(page, 0, 'Ужин')).toHaveAccessibleName(/вместе/);
    await expect(cards(page, 0, 'Бассейн')).toHaveCount(1);
    await expect(cards(page, 1, 'Бассейн')).toHaveCount(0);
  });

  test('sleep Friday 23:00 – Saturday 07:00 is on both days', async ({ page, request, couple }) => {
    await createEvent(
      request,
      couple.a,
      couple.workspace.id,
      event(couple, {
        title: 'Сон',
        start: at('2030-03-08', '23:00'),
        end: at('2030-03-09', '07:00'),
        who: 'a',
      }),
    );
    await loginViaUi(page, couple.a);
    await showDay(page, WEEK, '2030-03-08');
    await expect(cards(page, 0, 'Сон')).toHaveCount(1);
    await showDay(page, WEEK, '2030-03-09');
    await expect(cards(page, 0, 'Сон')).toHaveCount(1);
    await expect(cards(page, 1, 'Сон')).toHaveCount(0);
  });

  test('sleep on the week boundary (Sunday 23:00 – Monday 07:00) is in two weeks', async ({
    page,
    request,
    couple,
  }) => {
    await createEvent(
      request,
      couple.a,
      couple.workspace.id,
      event(couple, {
        title: 'Сон',
        start: at('2030-03-10', '23:00'),
        end: at('2030-03-11', '07:00'),
        who: 'a',
      }),
    );
    await loginViaUi(page, couple.a);
    await showDay(page, WEEK, '2030-03-10');
    await expect(cards(page, 0, 'Сон')).toHaveCount(1);
    await showDay(page, NEXT_WEEK, '2030-03-11');
    await expect(cards(page, 0, 'Сон')).toHaveCount(1);
  });

  test('a trip of several days is in its week, on each of its days', async ({
    page,
    request,
    couple,
  }) => {
    await createEvent(
      request,
      couple.a,
      couple.workspace.id,
      event(couple, {
        title: 'Поездка',
        start: at('2030-03-08', '08:00'),
        end: at('2030-03-10', '20:00'),
        who: 'both',
      }),
    );
    await loginViaUi(page, couple.a);
    for (const day of ['2030-03-08', '2030-03-09', '2030-03-10']) {
      await showDay(page, WEEK, day);
      await expect(cards(page, 0, 'Поездка')).toHaveCount(1);
      await expect(cards(page, 1, 'Поездка')).toHaveCount(1);
    }
    await showDay(page, WEEK, '2030-03-07');
    await expect(cards(page, 0, 'Поездка')).toHaveCount(0);
  });

  test('moving an event to the next day, then deleting it', async ({ page, request, couple }) => {
    await createEvent(
      request,
      couple.a,
      couple.workspace.id,
      event(couple, {
        title: 'Встреча',
        start: at('2030-03-05', '10:00'),
        end: at('2030-03-05', '11:00'),
        who: 'a',
      }),
    );
    await loginViaUi(page, couple.a);
    await showDay(page, WEEK, '2030-03-05');
    await cards(page, 0, 'Встреча').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Дата начала').fill('2030-03-06');
    await dialog.getByLabel('Дата окончания').fill('2030-03-06');
    await dialog.getByRole('button', { name: 'Сохранить' }).click();
    await expect(dialog).toBeHidden();
    await showDay(page, WEEK, '2030-03-05');
    await expect(cards(page, 0, 'Встреча')).toHaveCount(0);
    await showDay(page, WEEK, '2030-03-06');
    await expect(cards(page, 0, 'Встреча')).toHaveCount(1);

    await cards(page, 0, 'Встреча').click();
    await dialog.getByRole('button', { name: 'Удалить' }).click();
    await dialog.getByRole('button', { name: 'Точно удалить?' }).click();
    await expect(dialog).toBeHidden();
    await expect(cards(page, 0, 'Встреча')).toHaveCount(0);
  });

  test('a conflict: the partner saved first, «Загрузить актуальную» shows their version', async ({
    page,
    request,
    couple,
  }) => {
    const created = await createEvent(
      request,
      couple.a,
      couple.workspace.id,
      event(couple, {
        title: 'Обед',
        start: at('2030-03-05', '13:00'),
        end: at('2030-03-05', '14:00'),
        who: 'both',
      }),
    );
    await loginViaUi(page, couple.a);
    await showDay(page, WEEK, '2030-03-05');
    await cards(page, 0, 'Обед').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Название')).toHaveValue('Обед');

    // The partner saves a new version while A has the old one open.
    await updateEvent(request, couple.b, couple.workspace.id, created.id, {
      ...event(couple, {
        title: 'Обед в кафе',
        start: at('2030-03-05', '13:00'),
        end: at('2030-03-05', '14:00'),
        who: 'both',
      }),
      version: created.version,
    });

    await dialog.getByLabel('Название').fill('Обед дома');
    await dialog.getByRole('button', { name: 'Сохранить' }).click();
    const conflict = page.getByRole('dialog', { name: 'Партнёр изменил это событие' });
    await expect(conflict).toBeVisible();
    await conflict.getByRole('button', { name: 'Загрузить актуальную версию' }).click();
    await expect(conflict).toBeHidden();
    await expect(page.getByRole('dialog').getByLabel('Название')).toHaveValue('Обед в кафе');
  });
});
