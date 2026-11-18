import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SegmentedControl, type SegmentOption } from './segmented-control';

type Mode = 'login' | 'register' | 'reset';

@Component({
  imports: [SegmentedControl],
  template: `<tp-segmented-control
    label="Вход или регистрация"
    [options]="options"
    [(value)]="mode"
  />`,
})
class Host {
  readonly options: SegmentOption<Mode>[] = [
    { value: 'login', label: 'Вход' },
    { value: 'register', label: 'Регистрация' },
    { value: 'reset', label: 'Сброс' },
  ];
  readonly mode = signal<Mode>('login');
}

describe('SegmentedControl', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let group: HTMLElement;
  let radios: HTMLButtonElement[];

  const checked = () => radios.map((r) => r.getAttribute('aria-checked'));
  const tabStops = () => radios.map((r) => r.tabIndex);

  async function press(key: string, from = document.activeElement as HTMLElement) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    from.dispatchEvent(event);
    await fixture.whenStable();
    return event;
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await fixture.whenStable();
    group = (fixture.nativeElement as HTMLElement).querySelector('tp-segmented-control')!;
    radios = Array.from(group.querySelectorAll('button'));
  });

  it('is a named radio group with one checked option and one tab stop', () => {
    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Вход или регистрация');
    expect(radios.map((r) => r.textContent?.trim())).toEqual(['Вход', 'Регистрация', 'Сброс']);
    expect(radios.every((r) => r.getAttribute('role') === 'radio' && r.type === 'button')).toBe(
      true,
    );
    expect(checked()).toEqual(['true', 'false', 'false']);
    expect(tabStops()).toEqual([0, -1, -1]);
  });

  it('a click chooses the option and updates the two-way value', async () => {
    radios[1].click();
    await fixture.whenStable();
    expect(host.mode()).toBe('register');
    expect(checked()).toEqual(['false', 'true', 'false']);
    expect(tabStops()).toEqual([-1, 0, -1]);
  });

  it('follows a value set from outside', async () => {
    host.mode.set('reset');
    await fixture.whenStable();
    expect(checked()).toEqual(['false', 'false', 'true']);
  });

  it('arrows move focus and choose, wrapping around', async () => {
    radios[0].focus();
    const event = await press('ArrowRight');
    expect(event.defaultPrevented).toBe(true);
    expect(host.mode()).toBe('register');
    expect(document.activeElement).toBe(radios[1]);

    await press('ArrowDown');
    expect(host.mode()).toBe('reset');
    await press('ArrowRight');
    expect(host.mode()).toBe('login');
    expect(document.activeElement).toBe(radios[0]);

    await press('ArrowLeft');
    expect(host.mode()).toBe('reset');
    expect(document.activeElement).toBe(radios[2]);
    await press('ArrowUp');
    expect(host.mode()).toBe('register');
  });

  it('Home and End jump to the first and last option', async () => {
    radios[0].focus();
    await press('End');
    expect(host.mode()).toBe('reset');
    expect(document.activeElement).toBe(radios[2]);
    await press('Home');
    expect(host.mode()).toBe('login');
    expect(document.activeElement).toBe(radios[0]);
  });

  it('other keys are left alone', async () => {
    radios[0].focus();
    const event = await press('Tab');
    expect(event.defaultPrevented).toBe(false);
    expect(host.mode()).toBe('login');
  });

  it('a value matching no option leaves nothing checked, the first option takes Tab', async () => {
    host.mode.set('other' as Mode);
    await fixture.whenStable();
    expect(checked()).toEqual(['false', 'false', 'false']);
    expect(tabStops()).toEqual([0, -1, -1]);
    radios[0].focus();
    await press('ArrowRight');
    expect(host.mode()).toBe('register');
  });
});
