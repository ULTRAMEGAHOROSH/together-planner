import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { ComponentRef } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  APPLY_PREVIEW_MERGE,
  APPLY_PREVIEW_MERGE_AGAIN,
  APPLY_PREVIEW_REPLACE,
  AUTH_RESPONSE,
  WEEK,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import type { ApplyPreviewResponse } from '@core/api/models/template.models';
import type { WorkspaceResponse } from '@core/api/models/workspace.models';
import { SessionStore } from '@core/auth/session-store';
import { ApplyPreviewView } from './apply-preview';

const [FIRST, SECOND] = WEEK.members;

describe('tp-apply-preview (TPL-06)', () => {
  let fixture: ComponentFixture<ApplyPreviewView>;
  let ref: ComponentRef<ApplyPreviewView>;
  const host = () => fixture.nativeElement as HTMLElement;
  const text = () => host().textContent?.replace(/\s+/g, ' ') ?? '';
  const headings = () =>
    Array.from(host().querySelectorAll('h3')).map((h) => h.textContent?.trim());
  const lines = () =>
    Array.from(host().querySelectorAll('li')).map((li) =>
      Array.from(li.children)
        .map((c) => c.textContent)
        .join(' '),
    );
  const stats = () =>
    Array.from(host().querySelectorAll('.stat')).map((s) =>
      [s.querySelector('.value')?.textContent, s.querySelector('.label')?.textContent].join(' '),
    );

  async function show(
    preview: ApplyPreviewResponse | null,
    inputs: { status?: string; errorText?: string | null; manualDeleted?: boolean } = {},
  ) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace({
      ...WORKSPACE_FULL_PAIR,
      members: WEEK.members,
    } as unknown as WorkspaceResponse);
    fixture = TestBed.createComponent(ApplyPreviewView);
    ref = fixture.componentRef;
    ref.setInput('preview', preview);
    ref.setInput('status', inputs.status ?? (preview ? 'ready' : 'idle'));
    ref.setInput('errorText', inputs.errorText ?? null);
    ref.setInput('manualDeleted', inputs.manualDeleted ?? false);
    await fixture.whenStable();
  }

  it('always says that nothing is saved yet', async () => {
    await show(null);
    expect(text()).toContain('Предпросмотр — ничего ещё не сохранено');
  });

  it('shows a spinner while the first plan loads', async () => {
    await show(null, { status: 'loading' });
    expect(host().querySelector('tp-spinner')).not.toBeNull();
  });

  it('AP-06: an error is shown inside, with no plan', async () => {
    await show(null, { status: 'error', errorText: 'Уже удалено партнёром.' });
    expect(host().querySelector('.error')?.textContent).toBe('Уже удалено партнёром.');
    expect(host().querySelector('.plan')).toBeNull();
  });

  it('MERGE: counters, «Будет добавлено» by days with names', async () => {
    await show(APPLY_PREVIEW_MERGE);
    expect(stats()).toEqual(['+3 будет добавлено', '0 пропущено: уже созданы из этого шаблона']);
    expect(headings()).toContain('Будет добавлено: 3');
    const days = Array.from(host().querySelectorAll('.day-title')).map((d) => d.textContent);
    expect(days).toEqual([
      'Понедельник, 23 ноября',
      'Вторник, 24 ноября',
      'Воскресенье, 29 ноября',
    ]);
    // A shared event reads «вместе», a single one reads the name of the member.
    expect(lines()).toContain('Вт, 24 нояб. · 07:00–08:00 «Пробежка» вместе');
    expect(lines()).toContain(`Пн, 23 нояб. · 08:00–17:00 «Работа» ${FIRST.displayName}`);
    expect(lines().some((l) => l.endsWith(`«Сон» ${SECOND.displayName}`))).toBe(true);
  });

  it('AP-02: conflicts list the plan and what it meets, with names', async () => {
    await show(APPLY_PREVIEW_MERGE);
    expect(headings()).toContain('Пересечения (блоки встанут рядом)');
    const conflict = lines().find((l) => l.includes('↔')) ?? '';
    expect(conflict).toContain('Пн, 23 нояб. · 08:00–17:00');
    expect(conflict).toContain(`«Работа» (${FIRST.displayName})`);
    expect(conflict).toContain('↔ «Работа»');
  });

  it('the manual events of the week are said to stay', async () => {
    await show(APPLY_PREVIEW_MERGE);
    expect(text()).toContain('4 события, созданных вручную, останутся');
    await show({ ...APPLY_PREVIEW_MERGE, manualEventsInWeek: 1 });
    expect(text()).toContain('1 событие, созданное вручную, останется');
    await show({ ...APPLY_PREVIEW_MERGE, manualEventsInWeek: 0 });
    expect(text()).not.toContain('вручную');
  });

  it('with the tick of «Заменить» the manual events are not said to stay', async () => {
    await show(APPLY_PREVIEW_MERGE, { manualDeleted: true });
    expect(text()).not.toContain('останутся');
  });

  it('AP-05: «Вы удаляли — не вернём» and «Уже применено», and an empty plan says why', async () => {
    await show(APPLY_PREVIEW_MERGE_AGAIN);
    expect(headings()).toEqual(['Уже применено: 2', 'Вы удаляли — не вернём: 1']);
    expect(host().querySelector('.nothing')?.textContent).toContain('уже применён к этой неделе');
    expect(lines()).toContain('Вт, 24 нояб. · 07:00–08:00 «Пробежка» вместе');
  });

  it('an empty plan without anything applied says the days are taken', async () => {
    await show({ ...APPLY_PREVIEW_MERGE_AGAIN, skippedAlreadyApplied: [] });
    expect(host().querySelector('.nothing')?.textContent).toContain('Добавлять нечего');
  });

  it('FILL: «День занят» and its counter', async () => {
    await show({
      ...APPLY_PREVIEW_MERGE,
      mode: 'FILL',
      skippedBusy: APPLY_PREVIEW_MERGE.toCreate.slice(0, 1),
    });
    expect(stats()).toContain('1 пропущено: у участника день уже занят');
    expect(headings()).toContain('День занят: 1');
  });

  it('AP-03: REPLACE lists what will be deleted, by name, and its counter', async () => {
    await show(APPLY_PREVIEW_REPLACE);
    const deletes = APPLY_PREVIEW_REPLACE.toDelete.length;
    expect(deletes).toBeGreaterThan(0);
    expect(stats().at(-1)).toBe(`−${deletes} будет удалено`);
    expect(headings()).toContain(`Будет удалено: ${deletes}`);
    const titles = Array.from(host().querySelectorAll('.warn-delete .title')).map(
      (t) => t.textContent,
    );
    expect(titles).toEqual(APPLY_PREVIEW_REPLACE.toDelete.map((e) => `«${e.title}»`));
  });

  it('AP-04: «Будет восстановлено» when something comes back', async () => {
    await show(APPLY_PREVIEW_REPLACE);
    const restored = APPLY_PREVIEW_REPLACE.restoredDeleted.length;
    expect(restored).toBeGreaterThan(0);
    expect(headings()).toContain(`Будет восстановлено: ${restored}`);
    await show({ ...APPLY_PREVIEW_REPLACE, restoredDeleted: [] });
    expect(headings().some((h) => h?.startsWith('Будет восстановлено'))).toBe(false);
  });

  it('while the next plan loads the old one stays, dimmed', async () => {
    await show(APPLY_PREVIEW_MERGE, { status: 'loading' });
    expect(host().querySelector('.plan.stale')).not.toBeNull();
    await show(APPLY_PREVIEW_MERGE);
    expect(host().querySelector('.plan.stale')).toBeNull();
  });
});
