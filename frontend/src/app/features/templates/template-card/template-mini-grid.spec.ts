import { type ComponentFixture, TestBed } from '@angular/core/testing';
import {
  AUTH_RESPONSE,
  TEMPLATE_CREATED,
  WEEK,
  WORKSPACE_FULL_PAIR,
} from '@core/api/models/testing/samples';
import type { TemplateEventResponse } from '@core/api/models/template.models';
import type { WorkspaceResponse } from '@core/api/models/workspace.models';
import { SessionStore } from '@core/auth/session-store';
import { MINI_DAY_HEIGHT, TemplateMiniGrid } from './template-mini-grid';

const [FIRST, SECOND] = WEEK.members;
const event = (patch: Partial<TemplateEventResponse>): TemplateEventResponse => ({
  ...TEMPLATE_CREATED.events[0],
  id: 'e',
  title: 'Событие',
  dayOfWeek: 'MONDAY',
  startTime: '12:00',
  durationMinutes: 360,
  participantIds: [FIRST.userId],
  ...patch,
});

describe('tp-template-mini-grid (TPL-11)', () => {
  let fixture: ComponentFixture<TemplateMiniGrid>;
  const host = () => fixture.nativeElement as HTMLElement;
  const day = (index: number) => host().querySelectorAll('.day')[index] as HTMLElement;
  const bars = (dayIndex: number, column: number) =>
    Array.from(
      day(dayIndex).querySelectorAll('.column')[column].querySelectorAll<HTMLElement>('.bar'),
    );

  async function show(events: TemplateEventResponse[], members = WEEK.members) {
    TestBed.resetTestingModule();
    const session = TestBed.inject(SessionStore);
    session.setAuth(AUTH_RESPONSE);
    session.setWorkspace({ ...WORKSPACE_FULL_PAIR, members } as unknown as WorkspaceResponse);
    fixture = TestBed.createComponent(TemplateMiniGrid);
    fixture.componentRef.setInput('events', events);
    await fixture.whenStable();
  }

  it('is decoration: hidden from screen readers; seven days with their weekdays', async () => {
    await show([]);
    expect(host().getAttribute('aria-hidden')).toBe('true');
    expect(Array.from(host().querySelectorAll('.label')).map((l) => l.textContent)).toEqual([
      'Пн',
      'Вт',
      'Ср',
      'Чт',
      'Пт',
      'Сб',
      'Вс',
    ]);
  });

  it('the first member on the left, the second on the right, 96 px for 24 hours', async () => {
    await show([
      event({ id: 'a', participantIds: [FIRST.userId] }),
      event({ id: 'b', startTime: '06:00', durationMinutes: 120, participantIds: [SECOND.userId] }),
    ]);
    expect(day(0).querySelectorAll('.column')).toHaveLength(2);
    expect(bars(0, 0)).toHaveLength(1);
    expect(bars(0, 1)).toHaveLength(1);
    // 12:00 → half of the day, 6 hours → a quarter.
    expect(parseFloat(bars(0, 0)[0].style.top)).toBeCloseTo(MINI_DAY_HEIGHT / 2, 0);
    expect(parseFloat(bars(0, 0)[0].style.height)).toBeCloseTo(MINI_DAY_HEIGHT / 4, -0.5); // minus the gaps
    expect(parseFloat(bars(0, 1)[0].style.top)).toBeCloseTo(MINI_DAY_HEIGHT / 4, 0);
  });

  it('a joint event is in both columns; a very short one is still a visible bar', async () => {
    await show([event({ participantIds: [FIRST.userId, SECOND.userId], durationMinutes: 5 })]);
    expect(bars(0, 0)).toHaveLength(1);
    expect(bars(0, 1)).toHaveLength(1);
    expect(parseFloat(bars(0, 0)[0].style.height)).toBeGreaterThanOrEqual(1.4);
  });

  it('past Sunday midnight the event goes on in Monday of the same week', async () => {
    await show([event({ dayOfWeek: 'SUNDAY', startTime: '23:00', durationMinutes: 480 })]);
    expect(bars(6, 0)).toHaveLength(1);
    expect(bars(0, 0)).toHaveLength(1);
  });

  it('with one member there is one column', async () => {
    await show([event({})], [FIRST] as never);
    expect(day(0).querySelectorAll('.column')).toHaveLength(1);
  });
});
