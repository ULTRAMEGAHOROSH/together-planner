import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { EventResponse } from '@core/api/models/event.models';
import { EVENT_CREATED_JOINT, EVENT_CREATED_MANUAL, WEEK } from '@core/api/models/testing/samples';
import { EventHovercard } from './event-hovercard';

describe('EventHovercard (WEEK-14)', () => {
  let fixture: ComponentFixture<EventHovercard>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.trim();

  const render = async (event: EventResponse) => {
    fixture = TestBed.createComponent(EventHovercard);
    fixture.componentRef.setInput('event', event);
    fixture.componentRef.setInput('members', WEEK.members);
    await fixture.whenStable();
  };

  it('title, time, who, description and the hint', async () => {
    await render({
      ...EVENT_CREATED_JOINT,
      title: 'Ужин',
      description: 'у моря',
      start: '2026-11-25T19:00:00',
      end: '2026-11-25T21:00:00',
      participantIds: WEEK.members.map((m) => m.userId),
      source: null,
    });
    expect(text('.title')).toBe('Ужин');
    expect(text('.when')).toBe('Ср, 25 нояб. · 19:00–21:00');
    expect(text('.cat')).toBeTruthy();
    expect(text('.who')).toBe(
      `2 ч · вместе: ${WEEK.members.map((m) => m.displayName).join(' и ')}`,
    );
    expect(text('.description')).toBe('у моря');
    expect(el().querySelector('.template')).toBeNull();
    expect(text('.hint')).toBe('Нажмите, чтобы изменить');
    expect(el().getAttribute('role')).toBe('tooltip');
  });

  it('a template event says where it came from; no description, no empty line', async () => {
    await render({
      ...EVENT_CREATED_MANUAL,
      description: null,
      participantIds: [WEEK.members[0].userId],
      source: { templateEventId: 'te', weekStart: '2026-11-23', templateName: 'Обычная неделя' },
    });
    expect(text('.template')).toContain('Из шаблона «Обычная неделя»');
    expect(el().querySelector('.description')).toBeNull();
    expect(text('.who')).toContain(WEEK.members[0].displayName);
    expect(el().querySelector('.midnight')).toBeNull();
  });

  it('an event over midnight says it is shown in both days', async () => {
    await render({
      ...EVENT_CREATED_MANUAL,
      start: '2026-11-25T23:00:00',
      end: '2026-11-26T01:00:00',
    });
    expect(text('.midnight')).toContain('через полночь');
  });
});
