// SC-01…SC-05 of roadmap §8.4: the one scroll of the board, sticky headers, horizontal scroll
// of the week, the day view on a phone. Runs on the dev playground (/_dev/board): fixtures,
// no backend, no sign-in. Geometry is read from the real layout (bounding boxes).
import { expect, test, type Locator, type Page } from '@playwright/test';

const HOUR = 40;

const board = (page: Page) => page.locator('tp-schedule-board');
const panel = (page: Page, index: number) => page.locator('tp-person-panel').nth(index);
/** The sticky header of a panel (not the `.head` of event cards inside it). */
const panelHead = (page: Page, index: number) => panel(page, index).locator(':scope > .head');
const firstColumn = (page: Page, panelIndex: number) =>
  panel(page, panelIndex).locator('tp-day-column').first();

async function box(locator: Locator) {
  const rect = await locator.boundingBox();
  if (!rect) throw new Error('The element is not rendered');
  return rect;
}

async function scrollBoard(page: Page, top: number, left = 0) {
  await board(page).evaluate(
    (element, [y, x]) => {
      element.scrollTo(x, y);
    },
    [top, left],
  );
  // Let the browser apply the scroll and sticky positions.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
}

const pageOverflowsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

test.beforeEach(async ({ page }) => {
  await page.goto('/_dev/board');
  // 14 columns in «Неделя» (desktop), 2 in «День» (a phone starts there).
  await expect(page.locator('tp-day-column').first()).toBeVisible();
});

test.describe('desktop', () => {
  // The board is 86 + 960 px tall; a lower window makes 06:00 reachable (at 900 px the
  // playground leaves the board 822 px and the browser clamps the scroll to the end of the day).
  test.use({ viewport: { width: 1440, height: 700 } });

  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the desktop layout');
  });

  test('SC-01: opens scrolled to 06:00 — its line right under the sticky headers', async ({
    page,
  }) => {
    await expect.poll(() => board(page).evaluate((element) => element.scrollTop)).toBe(6 * HOUR);
    const line06 = (await box(firstColumn(page, 0))).y + 6 * HOUR;
    const headersBottom =
      (await box(panelHead(page, 0))).y + (await box(panelHead(page, 0))).height;
    expect(Math.abs(line06 - headersBottom)).toBeLessThanOrEqual(2);
  });

  test('SC-02: after scrolling 400 px the 12:00 line is at the same y in A, in B and in the scale', async ({
    page,
  }) => {
    await scrollBoard(page, 400);
    const line12 = async (index: number) => (await box(firstColumn(page, index))).y + 12 * HOUR;
    const [a, b] = [await line12(0), await line12(1)];
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1);

    const label = box(page.locator('tp-time-gutter .hour', { hasText: '12:00' }));
    const labelCenter = (await label).y + (await label).height / 2;
    expect(Math.abs(labelCenter - a)).toBeLessThanOrEqual(1);
  });

  test('SC-03: the headers of members and days stay where they are while scrolling', async ({
    page,
  }) => {
    const headers = [
      panelHead(page, 0),
      panelHead(page, 1),
      page.locator('tp-time-gutter .head'),
      panel(page, 0).locator('tp-day-header').first(),
      panel(page, 1).locator('tp-day-header').last(),
    ];
    const ys = async () => Promise.all(headers.map(async (header) => (await box(header)).y));
    await scrollBoard(page, 0);
    const before = await ys();
    for (const top of [400, 760]) {
      await scrollBoard(page, top);
      const after = await ys();
      after.forEach((y, i) => expect(Math.abs(y - before[i])).toBeLessThanOrEqual(1));
    }
    // They are visible: inside the board, above its content.
    const frame = await box(board(page));
    before.forEach((y) => expect(y).toBeGreaterThanOrEqual(frame.y));
    await expect(panel(page, 0).locator('tp-day-header').first()).toBeInViewport();
  });

  test('SC-04: 1000 px, «Неделя» — the board scrolls sideways, the page does not, all columns move together', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    const [scrollWidth, clientWidth] = await board(page).evaluate((element) => [
      element.scrollWidth,
      element.clientWidth,
    ]);
    expect(scrollWidth).toBeGreaterThan(clientWidth);
    expect(await pageOverflowsSideways(page)).toBe(false);

    const places = async () =>
      Promise.all(
        [firstColumn(page, 0), page.locator('tp-time-gutter'), firstColumn(page, 1)].map(
          async (item) => (await box(item)).x,
        ),
      );
    await scrollBoard(page, 0, 0);
    const before = await places();
    await scrollBoard(page, 0, 60);
    const after = await places();
    after.forEach((x, i) => expect(Math.abs(before[i] - x - 60)).toBeLessThanOrEqual(1));
    expect(await pageOverflowsSideways(page)).toBe(false);
  });
});

test.describe('mobile', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the phone layout');
  });

  // Below 820 px the board opens in «День» by itself (WEEK-13): no click on the switch.
  test('SC-05: 375 px opens in «День» — no sideways scroll, both columns of the day are on screen', async ({
    page,
  }) => {
    await expect(page.locator('tp-day-column')).toHaveCount(2);
    expect(await pageOverflowsSideways(page)).toBe(false);

    const width = await page.evaluate(() => window.innerWidth);
    for (const index of [0, 1]) {
      const rect = await box(firstColumn(page, index));
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width);
      expect(rect.width).toBeGreaterThan(100);
    }
  });

  test('«Неделя» on a phone scrolls inside the board, the page stays still', async ({ page }) => {
    await page.getByRole('radio', { name: 'Неделя', exact: true }).click();
    await expect(page.locator('tp-day-column')).toHaveCount(14);
    expect(await pageOverflowsSideways(page)).toBe(false);
    const [scrollWidth, clientWidth] = await board(page).evaluate((element) => [
      element.scrollWidth,
      element.clientWidth,
    ]);
    expect(scrollWidth).toBeGreaterThan(clientWidth);
  });
});
