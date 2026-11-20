// UX-03: accessibility in a real browser. axe-core (WCAG 2.x A/AA, incl. colour contrast) runs on
// every screen and dialog; the keyboard checks cover what axe cannot: a dialog holds the focus,
// Escape closes it and the focus goes back to what opened it.
import { createEvent, createTemplate } from './helpers/api';
import { expect, test } from './fixtures';
import { loginViaUi } from './helpers/ui';
import type { Page } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };
declare const require: { resolve(id: string): string };

const AXE_PATH = require.resolve('axe-core/axe.min.js');

interface Violation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[]; failureSummary?: string }[];
}

async function axeViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: AXE_PATH });
  const found = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run: (c: unknown, o: unknown) => Promise<{ violations: unknown[] }> };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return result.violations;
  });
  return (found as Violation[]).map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .slice(0, 3)
        .map(
          (n) =>
            n.target.join(' ') +
            (process.env['A11Y_REPORT'] === '1'
              ? ' :: ' + (n.failureSummary ?? '').replace(/s+/g, ' ')
              : ''),
        )
        .join(' | ')}`,
  );
}

const ONLY = process.env['A11Y_REPORT'] === '1';

test.describe('accessibility (UX-03)', () => {
  // The app's CSP forbids an injected script; the test page may inject axe.
  test.use({ bypassCSP: true });

  test('axe: every screen and dialog has no WCAG A/AA violation', async ({
    page,
    request,
    couple,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'the width does not change the markup');
    const ws = couple.workspace.id;
    const both = [couple.a.id, couple.b.id];
    await createEvent(request, couple.a, ws, {
      title: 'Кино',
      description: null,
      start: '2030-03-15T20:00:00',
      end: '2030-03-15T22:00:00',
      participantIds: both,
      category: 'OTHER',
      color: null,
    });
    const template = await createTemplate(request, couple.a, ws, {
      name: 'Неделя',
      description: null,
      events: [
        {
          id: null,
          title: 'Работа',
          description: null,
          dayOfWeek: 'MONDAY',
          startTime: '09:00',
          durationMinutes: 60,
          participantIds: both,
          category: 'WORK',
          color: null,
        },
      ],
    });

    const problems: string[] = [];
    const check = async (name: string) => {
      for (const v of await axeViolations(page)) problems.push(`${name}: ${v}`);
    };

    for (const path of ['/login', '/register']) {
      await page.goto(path);
      await expect(page.getByRole('button').first()).toBeVisible();
      await check(path);
    }
    await loginViaUi(page, couple.a);
    const screens: [string, string][] = [
      ['week', '/week/2030-03-11'],
      ['calendar', '/calendar?month=2030-03'],
      ['templates', '/templates'],
      ['template editor', `/templates/${template.id}`],
      ['template new', '/templates/new'],
      ['settings', '/settings'],
    ];
    for (const [name, path] of screens) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await check(name);
    }

    await page.goto('/week/2030-03-11');
    await page.getByRole('button', { name: 'Новое событие' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await check('dialog: new event');
    await page.keyboard.press('Escape');

    await page.goto('/templates');
    await page.getByRole('button', { name: 'Применить', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await check('dialog: apply template');

    if (ONLY) console.log(problems.join('\n'));
    expect(problems).toEqual([]);
  });

  test('a dialog holds the focus, Escape closes it, the focus returns to its opener', async ({
    page,
    couple,
  }) => {
    await loginViaUi(page, couple.a);
    await page.goto('/week/2030-03-11');
    const opener = page.getByRole('button', { name: 'Новое событие' });
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('keyboard: the focus is visible on the controls it reaches', async ({ page, couple }) => {
    await loginViaUi(page, couple.a);
    await page.goto('/week/2030-03-11');
    const invisible: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const state = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
        const shadow = s.boxShadow !== 'none';
        return {
          name: `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20)}`,
          ok: outline || shadow,
        };
      });
      if (state && !state.ok) invisible.push(state.name);
    }
    expect(invisible).toEqual([]);
  });

  test('prefers-reduced-motion: animations and transitions are switched off', async ({
    page,
    couple,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loginViaUi(page, couple.a);
    await page.goto('/week/2030-03-11');
    await page.getByRole('button', { name: 'Новое событие' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const durations = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        const s = getComputedStyle(el);
        const t = parseFloat(s.transitionDuration.split(',')[0]);
        const a = parseFloat(s.animationDuration.split(',')[0]);
        const infinite = s.animationIterationCount === 'infinite' && a > 0.01;
        if (t > 0.01 || (a > 0.01 && s.animationName !== 'none') || infinite) {
          bad.push(`${el.tagName}.${el.className}`.slice(0, 60));
        }
      }
      return bad;
    });
    expect(durations).toEqual([]);
  });
});
