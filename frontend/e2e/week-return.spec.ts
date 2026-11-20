// WEEK-16 on the real backend: the partner adds an event while this tab is in the background;
// when the tab is shown again (after the 30 s pause) the event is on the board without F5.
import { createEvent } from './helpers/api';
import { expect, test } from './fixtures';
import { loginViaUi } from './helpers/ui';

test('the tab comes back: the partner’s new event appears without a reload', async ({
  page,
  request,
  couple,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'the markup does not depend on the width');
  await page.clock.install();
  await loginViaUi(page, couple.a);
  await expect(page.locator('tp-person-panel')).toHaveCount(2);
  await expect(page.getByText('Созвон с банком')).toHaveCount(0);

  // The partner works in the zone of the workspace: «today» + 1 h is in the shown week.
  const start = new Date(Date.now() + 3_600_000);
  const end = new Date(start.getTime() + 1_800_000);
  const local = (d: Date) => d.toISOString().slice(0, 19);
  await createEvent(request, couple.b, couple.workspace.id, {
    title: 'Созвон с банком',
    description: null,
    start: local(start),
    end: local(end),
    participantIds: [couple.b.id],
    category: 'WORK',
    color: null,
  });

  // The tab was away longer than the pause, then it is shown again.
  await page.clock.fastForward(31_000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('Созвон с банком').first()).toBeVisible();
});
