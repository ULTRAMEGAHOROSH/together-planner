// QA-04: the main business scenario of templates, from the screen to the database (T1–T7, S1,
// E6). The template of 3 events is made by the API (the editor has its own tests); applying,
// the preview and the confirmation are driven on the screen, and the week is checked in S1.
import type { Page } from '@playwright/test';
import { createTemplate, deleteEvent, getWeek, updateTemplate } from './helpers/api';
import { expect, test } from './fixtures';
import { loginViaUi } from './helpers/ui';

const WEEK = '2030-03-04'; // a Monday, far from «now»

const dialog = (page: Page) => page.getByRole('dialog');

async function openApply(page: Page) {
  await page.goto(`/week/${WEEK}`);
  await expect(page.locator('tp-person-panel')).toHaveCount(2);
  await page.getByRole('button', { name: 'Применить шаблон' }).first().click();
  await expect(dialog(page).getByText('Предпросмотр — ничего ещё не сохранено')).toBeVisible();
}
const heading = (page: Page, text: string | RegExp) =>
  dialog(page).getByRole('heading', { name: text });

test('a template: apply, apply again, delete, replace, change the template', async ({
  page,
  request,
  couple,
}) => {
  const ws = couple.workspace.id;
  const both = [couple.a.id, couple.b.id];
  const template = await createTemplate(request, couple.a, ws, {
    name: 'Обычная неделя',
    description: null,
    events: [
      {
        id: null,
        title: 'Работа',
        description: null,
        dayOfWeek: 'MONDAY',
        startTime: '09:00',
        durationMinutes: 480,
        participantIds: [couple.a.id],
        category: 'WORK',
        color: null,
      },
      {
        id: null,
        title: 'Пробежка',
        description: null,
        dayOfWeek: 'TUESDAY',
        startTime: '07:00',
        durationMinutes: 60,
        participantIds: both,
        category: 'SPORT',
        color: null,
      },
      {
        id: null,
        title: 'Сон',
        description: null,
        dayOfWeek: 'SUNDAY',
        startTime: '23:00',
        durationMinutes: 480,
        participantIds: [couple.a.id],
        category: 'SLEEP',
        color: null,
      },
    ],
  });
  expect(template.events).toHaveLength(3);
  const titles = async () =>
    (await getWeek(request, couple.a, ws, WEEK)).events.map((e) => e.title).sort();

  await loginViaUi(page, couple.a);

  // 2. «Добавить к существующим» on an empty week: three events appear.
  await openApply(page);
  await expect(heading(page, 'Будет добавлено: 3')).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Применить: +3' }).click();
  await expect(dialog(page)).toBeHidden();
  expect(await titles()).toEqual(['Пробежка', 'Работа', 'Сон']);
  // The shared run is in both panels of its day.
  await page.goto(`/week/${WEEK}?day=2030-03-05`);
  for (const panel of [0, 1]) {
    await expect(
      page
        .locator('tp-person-panel')
        .nth(panel)
        .locator('tp-event-card button', { hasText: 'Пробежка' }),
    ).toHaveCount(1);
  }

  // 3. Again: nothing to add, everything is «уже применено».
  await openApply(page);
  await expect(heading(page, 'Уже применено: 3')).toBeVisible();
  await expect(heading(page, /Будет добавлено/)).toHaveCount(0);
  await expect(dialog(page).getByRole('button', { name: 'Применить: +0' })).toBeDisabled();
  await dialog(page).getByRole('button', { name: 'Отмена' }).click();

  // 4. One event is deleted: «Добавить» does not bring it back, and says so.
  const work = (await getWeek(request, couple.a, ws, WEEK)).events.find(
    (e) => e.title === 'Работа',
  )!;
  await deleteEvent(request, couple.a, ws, work.id, work.version);
  await openApply(page);
  await expect(heading(page, 'Вы удаляли — не вернём: 1')).toBeVisible();
  await expect(heading(page, 'Уже применено: 2')).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: 'Применить: +0' })).toBeDisabled();

  // 5. «Заменить»: the plan lists what is restored, a confirmation, then the event is back.
  await dialog(page)
    .getByRole('radio', { name: /Заменить/ })
    .click();
  await expect(heading(page, 'Будет восстановлено: 1')).toBeVisible();
  await expect(heading(page, 'Будет удалено: 2')).toBeVisible();
  await dialog(page)
    .getByRole('button', { name: /^Заменить: / })
    .click();
  await expect(heading(page, 'Заменить события недели?')).toBeVisible();
  await dialog(page)
    .getByRole('button', { name: /^Заменить: / })
    .click();
  await expect(dialog(page)).toBeHidden();
  expect(await titles()).toEqual(['Пробежка', 'Работа', 'Сон']);

  // 6. The template changes: the week that was filled before does not.
  const before = (await getWeek(request, couple.a, ws, WEEK)).events
    .map((e) => `${e.title}|${e.start}|${e.end}`)
    .sort();
  await updateTemplate(request, couple.a, ws, template.id, {
    name: 'Другая неделя',
    description: null,
    version: template.version,
    events: [
      {
        id: null,
        title: 'Отпуск',
        description: null,
        dayOfWeek: 'FRIDAY',
        startTime: '10:00',
        durationMinutes: 60,
        participantIds: both,
        category: 'TRIP',
        color: null,
      },
    ],
  });
  const after = (await getWeek(request, couple.a, ws, WEEK)).events
    .map((e) => `${e.title}|${e.start}|${e.end}`)
    .sort();
  expect(after).toEqual(before);
});
