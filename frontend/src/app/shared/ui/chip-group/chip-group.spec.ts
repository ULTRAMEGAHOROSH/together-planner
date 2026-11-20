import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ChipGroup, type ChipOption } from './chip-group';

type Kind = 'work' | 'food' | 'other';

@Component({
  imports: [ChipGroup],
  template: `<tp-chip-group label="Категория" [options]="options" [(value)]="kind" />`,
})
class Host {
  readonly options: ChipOption<Kind>[] = [
    { value: 'work', label: 'Работа', dot: '#3E73C6', bg: '#DCE7FA', fg: '#1B4A86' },
    { value: 'food', label: 'Еда', dot: '#D99A2B' },
    { value: 'other', label: 'Другое' },
  ];
  readonly kind = signal<Kind>('work');
}

describe('ChipGroup', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let group: HTMLElement;
  let chips: HTMLButtonElement[];

  const checked = () => chips.map((c) => c.getAttribute('aria-checked'));

  async function press(key: string) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    (document.activeElement as HTMLElement).dispatchEvent(event);
    await fixture.whenStable();
    return event;
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await fixture.whenStable();
    group = (fixture.nativeElement as HTMLElement).querySelector('tp-chip-group')!;
    chips = Array.from(group.querySelectorAll('button'));
  });

  it('is a named radio group with one checked chip and one tab stop', () => {
    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Категория');
    expect(chips.map((c) => c.textContent?.trim())).toEqual(['Работа', 'Еда', 'Другое']);
    expect(chips.every((c) => c.getAttribute('role') === 'radio' && c.type === 'button')).toBe(
      true,
    );
    expect(checked()).toEqual(['true', 'false', 'false']);
    expect(chips.map((c) => c.tabIndex)).toEqual([0, -1, -1]);
  });

  it('shows a dot and colors only for options that have them', () => {
    expect(chips[0].querySelector('.dot')).not.toBeNull();
    expect((chips[0].querySelector('.dot') as HTMLElement).style.background).not.toBe('');
    expect(chips[0].style.getPropertyValue('--tp-chip-bg')).toBe('#DCE7FA');
    expect(chips[0].style.getPropertyValue('--tp-chip-fg')).toBe('#1B4A86');
    expect(chips[1].querySelector('.dot')).not.toBeNull();
    expect(chips[1].style.getPropertyValue('--tp-chip-bg')).toBe('');
    expect(chips[2].querySelector('.dot')).toBeNull();
  });

  it('a click chooses the chip and updates the two-way value', async () => {
    chips[1].click();
    await fixture.whenStable();
    expect(host.kind()).toBe('food');
    expect(checked()).toEqual(['false', 'true', 'false']);
    expect(chips.map((c) => c.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('follows a value set from outside', async () => {
    host.kind.set('other');
    await fixture.whenStable();
    expect(checked()).toEqual(['false', 'false', 'true']);
  });

  it('arrows move focus and choose, wrapping around', async () => {
    chips[0].focus();
    const event = await press('ArrowRight');
    expect(event.defaultPrevented).toBe(true);
    expect(host.kind()).toBe('food');
    expect(document.activeElement).toBe(chips[1]);

    await press('ArrowDown');
    expect(host.kind()).toBe('other');
    await press('ArrowRight');
    expect(host.kind()).toBe('work');

    await press('ArrowLeft');
    expect(host.kind()).toBe('other');
    expect(document.activeElement).toBe(chips[2]);
    await press('ArrowUp');
    expect(host.kind()).toBe('food');
  });

  it('Home and End jump to the first and last chip', async () => {
    chips[0].focus();
    await press('End');
    expect(host.kind()).toBe('other');
    expect(document.activeElement).toBe(chips[2]);
    await press('Home');
    expect(host.kind()).toBe('work');
  });

  it('other keys are left alone', async () => {
    chips[0].focus();
    const event = await press('Tab');
    expect(event.defaultPrevented).toBe(false);
    expect(host.kind()).toBe('work');
  });

  it('a value matching no chip leaves nothing checked, the first chip takes Tab', async () => {
    host.kind.set('none' as Kind);
    await fixture.whenStable();
    expect(checked()).toEqual(['false', 'false', 'false']);
    expect(chips.map((c) => c.tabIndex)).toEqual([0, -1, -1]);
  });
});
