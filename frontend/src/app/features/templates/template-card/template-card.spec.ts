import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentRef } from '@angular/core';
import {
  AUTH_RESPONSE,
  TEMPLATE_CREATED,
  TEMPLATE_WITH_LAST_APPLICATION,
  WEEK,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import type { WorkspaceResponse } from '@core/api/models/workspace.models';
import { SessionStore } from '@core/auth/session-store';
import { TemplateCard } from './template-card';

describe('tp-template-card (TPL-02)', () => {
  let fixture: ComponentFixture<TemplateCard>;
  let ref: ComponentRef<TemplateCard>;
  const host = () => fixture.nativeElement as HTMLElement;
  const buttons = () => Array.from(host().querySelectorAll('button'));
  const chips = () => Array.from(host().querySelectorAll('.chips li')).map((li) => li.textContent);

  function create(members = WEEK.members as unknown as WorkspaceResponse['members']) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace({ ...WORKSPACE_FULL_PAIR, members });
    fixture = TestBed.createComponent(TemplateCard);
    ref = fixture.componentRef;
    ref.setInput('template', TEMPLATE_CREATED);
  }

  it('shows the name, the counters (together apart) and «Ещё не применялся»', async () => {
    create();
    await fixture.whenStable();
    const [first, second] = WEEK.members;
    expect(host().querySelector('.name')?.textContent).toBe('Обычная неделя');
    expect(chips()).toEqual([
      `${first.displayName} · 1`,
      `${second.displayName} · 1`,
      'вместе · 1',
    ]);
    expect(host().querySelector('.applied')?.textContent).toBe('Ещё не применялся');
  });

  it('shows the last application as a short week', async () => {
    create();
    ref.setInput('template', TEMPLATE_WITH_LAST_APPLICATION);
    await fixture.whenStable();
    expect(host().querySelector('.applied')?.textContent).toBe('Последний раз: неделя 23–29 нояб.');
  });

  it('«Применить» emits apply (TPL-08)', async () => {
    create();
    await fixture.whenStable();
    const apply = vi.fn();
    fixture.componentInstance.apply.subscribe(apply);
    buttons()[0].click();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('«Открыть» emits open', async () => {
    create();
    await fixture.whenStable();
    const open = vi.fn();
    fixture.componentInstance.open.subscribe(open);
    buttons()[1].click();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('«Удалить» asks twice: «Точно удалить?» and only then emits remove', async () => {
    create();
    await fixture.whenStable();
    const remove = vi.fn();
    fixture.componentInstance.remove.subscribe(remove);
    const del = () => buttons()[2];
    expect(del().textContent?.trim()).toBe('Удалить');
    del().click();
    await fixture.whenStable();
    expect(remove).not.toHaveBeenCalled();
    expect(del().textContent?.trim()).toBe('Точно удалить?');
    del().click();
    await fixture.whenStable();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(del().textContent?.trim()).toBe('Удалить');
  });

  it('leaving the button takes the question back', async () => {
    create();
    await fixture.whenStable();
    const remove = vi.fn();
    fixture.componentInstance.remove.subscribe(remove);
    buttons()[2].click();
    await fixture.whenStable();
    buttons()[2].dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(buttons()[2].textContent?.trim()).toBe('Удалить');
    buttons()[2].click();
    expect(remove).not.toHaveBeenCalled();
  });

  it('without a partner there is one member chip, and «вместе» only if such events exist', async () => {
    create([WEEK.members[0]] as unknown as WorkspaceResponse['members']);
    await fixture.whenStable();
    expect(chips()).toHaveLength(2);
    ref.setInput('template', { ...TEMPLATE_CREATED, events: [] });
    await fixture.whenStable();
    expect(chips()).toEqual([`${WEEK.members[0].displayName} · 0`]);
  });
});
