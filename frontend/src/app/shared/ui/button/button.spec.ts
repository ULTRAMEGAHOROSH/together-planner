import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Button, type ButtonVariant } from './button';

@Component({
  imports: [Button],
  template: `
    <form (submit)="submitted = submitted + 1; $event.preventDefault()">
      <input aria-label="Поле" />
      <button
        tpButton
        type="submit"
        class="wide"
        [variant]="variant()"
        [loading]="loading()"
        [disabled]="disabled()"
        (click)="clicks = clicks + 1"
      >
        Войти
      </button>
    </form>
    <button tpButton size="sm" type="button">Сегодня</button>
  `,
})
class Host {
  readonly variant = signal<ButtonVariant>('primary');
  readonly loading = signal(false);
  readonly disabled = signal(false);
  clicks = 0;
  submitted = 0;
}

describe('Button', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let button: HTMLButtonElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await fixture.whenStable();
    button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
  });

  it('is the native button with the variant as a class, keeping its own classes', async () => {
    expect(button.type).toBe('submit');
    expect(button.classList).toContain('primary');
    expect(button.classList).toContain('wide');
    host.variant.set('danger');
    await fixture.whenStable();
    expect(button.classList).toContain('danger');
    expect(button.classList).not.toContain('primary');
    expect(button.classList).toContain('wide');
  });

  it('size sm is a class; md is the default', () => {
    const small = (fixture.nativeElement as HTMLElement).querySelectorAll('button')[1];
    expect(small.classList).toContain('sm');
    expect(button.classList).not.toContain('sm');
  });

  it('clicks and submits the form when idle', () => {
    button.click();
    expect(host.clicks).toBe(1);
    expect(host.submitted).toBe(1);
  });

  it('loading blocks the button: no click handler, no submit, spinner, still focusable', async () => {
    host.loading.set(true);
    await fixture.whenStable();

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(button.querySelector('tp-spinner')?.getAttribute('aria-hidden')).toBe('true');
    // The label stays: it is still the accessible name.
    expect(button.textContent?.trim()).toBe('Войти');

    button.focus();
    button.click();
    expect(document.activeElement).toBe(button);
    expect(host.clicks).toBe(0);
    expect(host.submitted).toBe(0);

    host.loading.set(false);
    await fixture.whenStable();
    expect(button.hasAttribute('aria-disabled')).toBe(false);
    expect(button.querySelector('tp-spinner')).toBeNull();
    button.click();
    expect(host.clicks).toBe(1);
    expect(host.submitted).toBe(1);
  });

  it('disabled is the native attribute', async () => {
    host.disabled.set(true);
    await fixture.whenStable();
    expect(button.disabled).toBe(true);
    button.click();
    expect(host.clicks).toBe(0);
    expect(host.submitted).toBe(0);
  });
});
