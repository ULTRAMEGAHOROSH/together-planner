import { type ComponentFixture, TestBed } from '@angular/core/testing';
import type { ComponentRef } from '@angular/core';
import { WEEK } from '@core/api/models/testing/samples';
import type { MemberResponse } from '@core/api/models/workspace.models';
import { ERROR_MESSAGES, FIELD_ERROR_MESSAGES } from '@core/error/error-messages';
import { createTemplateEventRow, type TemplateEventRow } from '../template-form';
import { TemplateEventRowComponent } from './template-event-row';

const MEMBERS = WEEK.members as unknown as readonly MemberResponse[];

const VALID = {
  title: 'Работа',
  startTime: '09:00',
  endTime: '13:00',
  participants: { seat1: true, seat2: false },
};

describe('tp-template-event-row (TPL-04)', () => {
  let fixture: ComponentFixture<TemplateEventRowComponent>;
  let ref: ComponentRef<TemplateEventRowComponent>;
  let row: TemplateEventRow;
  const host = () => fixture.nativeElement as HTMLElement;
  const input = (label: string) =>
    host().querySelector(`[aria-label="${label}"]`) as HTMLInputElement | HTMLSelectElement;
  const buttonWithText = (text: string) =>
    Array.from(host().querySelectorAll('button')).find((b) =>
      b.textContent?.includes(text),
    ) as HTMLButtonElement;
  const errorTexts = () =>
    Array.from(host().querySelectorAll('.error')).map((e) => e.textContent?.trim());

  async function create(value: Parameters<typeof createTemplateEventRow>[0] = VALID) {
    row = createTemplateEventRow(value);
    fixture = TestBed.createComponent(TemplateEventRowComponent);
    ref = fixture.componentRef;
    ref.setInput('row', row);
    ref.setInput('members', MEMBERS);
    await fixture.whenStable();
  }

  it('shows the values of the row', async () => {
    await create({ ...VALID, dayOfWeek: 'TUESDAY', endDayOffset: 1 });
    expect(input('Название').value).toBe('Работа');
    expect(input('Время начала').value).toBe('09:00');
    expect(input('Время окончания').value).toBe('13:00');
    expect((input('День') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Вт');
    expect(
      (input('Окончание через дней') as HTMLSelectElement).selectedOptions[0].textContent?.trim(),
    ).toBe('+1 дн.');
  });

  it('typing goes to the form', async () => {
    await create();
    const title = input('Название') as HTMLInputElement;
    title.value = 'Ужин';
    title.dispatchEvent(new Event('input'));
    expect(row.controls.title.value).toBe('Ужин');
  });

  it('an end earlier than the start turns «+1 дн.» on by itself', async () => {
    await create({ ...VALID, startTime: '23:00', endTime: '23:30' });
    const end = input('Время окончания') as HTMLInputElement;
    end.value = '07:00';
    end.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(row.controls.endDayOffset.value).toBe(1);
    expect(
      (input('Окончание через дней') as HTMLSelectElement).selectedOptions[0].textContent?.trim(),
    ).toBe('+1 дн.');
  });

  it('«+7 дн.» is offered only for a row that already has it', async () => {
    await create();
    expect((input('Окончание через дней') as HTMLSelectElement).options).toHaveLength(7);
    await create({ ...VALID, startTime: '00:00', endTime: '00:00', endDayOffset: 7 });
    expect((input('Окончание через дней') as HTMLSelectElement).options).toHaveLength(8);
  });

  it('participants: a button per member and «Оба»', async () => {
    await create();
    const [first, second] = Array.from(host().querySelectorAll<HTMLButtonElement>('.person'));
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(second.getAttribute('aria-pressed')).toBe('false');
    second.click();
    await fixture.whenStable();
    expect(row.controls.participants.value).toEqual({ seat1: true, seat2: true });
    first.click();
    await fixture.whenStable();
    expect(row.controls.participants.value).toEqual({ seat1: false, seat2: true });
    buttonWithText('Оба').click();
    expect(row.controls.participants.value).toEqual({ seat1: true, seat2: true });
  });

  it('errors stay hidden until the first save attempt, then show', async () => {
    await create({ ...VALID, title: '', participants: { seat1: false, seat2: false } });
    expect(errorTexts()).toEqual([]);
    ref.setInput('submitted', true);
    await fixture.whenStable();
    expect(errorTexts()).toEqual([
      FIELD_ERROR_MESSAGES.required,
      FIELD_ERROR_MESSAGES.noParticipants,
    ]);
  });

  it('an end that is not after the start shows its error once the field was touched', async () => {
    await create({ ...VALID, startTime: '08:00', endTime: '08:00' });
    const end = input('Время окончания');
    end.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(errorTexts()).toEqual([ERROR_MESSAGES.EVENT_END_NOT_AFTER_START]);
  });

  it('the description is folded until asked for, or until it has text or an error', async () => {
    await create();
    expect(host().querySelector('textarea')).toBeNull();
    buttonWithText('Описание').click();
    await fixture.whenStable();
    expect(host().querySelector('textarea')).not.toBeNull();
    await create({ ...VALID, description: 'Парк' });
    expect(host().querySelector('textarea')).not.toBeNull();
  });

  it('«Дублировать» and «Удалить» emit', async () => {
    await create();
    const duplicate = vi.fn();
    const remove = vi.fn();
    fixture.componentInstance.duplicate.subscribe(duplicate);
    fixture.componentInstance.remove.subscribe(remove);
    buttonWithText('Дублировать').click();
    buttonWithText('Удалить').click();
    expect(duplicate).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('the day and the start time, once settled, ask the page to sort', async () => {
    await create();
    const commit = vi.fn();
    fixture.componentInstance.commit.subscribe(commit);
    input('Время начала').dispatchEvent(new Event('blur'));
    input('День').dispatchEvent(new Event('change'));
    expect(commit).toHaveBeenCalledTimes(2);
  });
});
