import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { TEMPLATE_CREATED, WEEK } from '@core/api/models/testing/samples';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { createTemplateForm, fromTemplateResponse } from '../template-form';
import {
  previewEventsOfForm,
  previewIdOfRow,
  rowOfPreviewId,
  TemplatePreview,
} from './template-preview';

const MEMBERS = WEEK.members as unknown as MemberResponse[];

describe('template preview (TPL-09)', () => {
  describe('previewEventsOfForm', () => {
    it('takes the rows of the form as they are, with the id of their position', () => {
      const form = createTemplateForm(fromTemplateResponse(TEMPLATE_CREATED, MEMBERS));
      const events = previewEventsOfForm(form, MEMBERS);
      expect(events).toHaveLength(TEMPLATE_CREATED.events.length);
      expect(events.map((e) => e.id)).toEqual(events.map((_, i) => previewIdOfRow(i)));
    });

    it('leaves out rows that are not an event yet: no time, no duration, nobody', () => {
      const form = createTemplateForm({
        ...fromTemplateResponse(TEMPLATE_CREATED, MEMBERS),
        events: [
          { startTime: '', endTime: '', participants: { seat1: true, seat2: false } },
          { startTime: '08:00', endTime: '08:00', participants: { seat1: true, seat2: false } },
          { startTime: '08:00', endTime: '09:00', participants: { seat1: false, seat2: false } },
          {
            title: '  ',
            startTime: '08:00',
            endTime: '09:00',
            participants: { seat1: true, seat2: true },
          },
        ] as never,
      });
      const events = previewEventsOfForm(form, MEMBERS);
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('row-3');
      expect(events[0].title).toBe('Без названия');
      expect(events[0].participantIds).toEqual(MEMBERS.map((m) => m.userId));
    });

    it('row ids go back to positions; other ids are not rows', () => {
      expect(rowOfPreviewId(previewIdOfRow(4))).toBe(4);
      expect(rowOfPreviewId('some-uuid')).toBeNull();
      expect(rowOfPreviewId('row-x')).toBeNull();
    });
  });

  describe('tp-template-preview', () => {
    let fixture: ComponentFixture<TemplatePreview>;
    const host = () => fixture.nativeElement as HTMLElement;

    async function show(
      events = previewEventsOfForm(
        createTemplateForm(fromTemplateResponse(TEMPLATE_CREATED, MEMBERS)),
        MEMBERS,
      ),
    ) {
      fixture = TestBed.createComponent(TemplatePreview);
      fixture.componentRef.setInput('events', events);
      fixture.componentRef.setInput('members', MEMBERS);
      await fixture.whenStable();
    }

    it('two panels with weekdays only, read only: no «create» places, no today line', async () => {
      await show();
      expect(host().querySelectorAll('tp-person-panel')).toHaveLength(2);
      const heads = Array.from(host().querySelectorAll('tp-day-header')).map((h) =>
        h.textContent?.trim(),
      );
      expect(heads.slice(0, 7)).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);
      expect(host().querySelector('button.slot')).toBeNull();
      expect(host().querySelector('tp-now-indicator')).toBeNull();
    });

    it('a card is a button that reports the id of its event', async () => {
      await show();
      const ids: string[] = [];
      fixture.componentInstance.rowClick.subscribe((id) => ids.push(id));
      const card = host().querySelector('tp-event-card button') as HTMLButtonElement;
      card.click();
      expect(ids).toHaveLength(1);
      expect(ids[0]).toMatch(/^row-\d+$/);
    });

    it('an empty template says there is nothing to show', async () => {
      await show([]);
      expect(host().querySelector('.hint')?.textContent).toContain('нечего показывать');
      expect(host().querySelector('tp-event-card')).toBeNull();
    });
  });
});
