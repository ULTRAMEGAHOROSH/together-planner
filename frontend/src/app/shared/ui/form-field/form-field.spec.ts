import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormField, FormFieldControl } from './form-field';

@Component({
  imports: [FormField, FormFieldControl],
  template: `
    <tp-form-field label="Email" [hint]="hint()" [error]="error()">
      <input tpControl type="email" />
    </tp-form-field>
    <tp-form-field label="Описание">
      <textarea tpControl></textarea>
    </tp-form-field>
  `,
})
class Host {
  readonly hint = signal<string | null>(null);
  readonly error = signal<string | null>(null);
}

describe('FormField', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let root: HTMLElement;
  let input: HTMLInputElement;

  const field = () => root.querySelector('tp-form-field')!;
  const byId = (id: string) => root.querySelector<HTMLElement>(`[id="${id}"]`);
  const describedBy = () => (input.getAttribute('aria-describedby') ?? '').split(' ');

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await fixture.whenStable();
    root = fixture.nativeElement as HTMLElement;
    input = root.querySelector('input')!;
  });

  it('the label names the control; the control gets the input look', () => {
    const label = field().querySelector('label')!;
    expect(label.textContent).toBe('Email');
    expect(input.id).not.toBe('');
    expect(label.htmlFor).toBe(input.id);
    expect(input.labels?.[0]).toBe(label);
    expect(input.classList).toContain('tp-control');
  });

  it('without hint and error the control is described by nothing and valid', () => {
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(field().querySelector('.hint, .error')).toBeNull();
  });

  it('shows the error and links it to the control', async () => {
    host.error.set('Введите email');
    await fixture.whenStable();
    const error = field().querySelector('.error')!;
    expect(error.textContent).toBe('Введите email');
    expect(describedBy()).toEqual([error.id]);
    expect(input.getAttribute('aria-invalid')).toBe('true');

    host.error.set(null);
    await fixture.whenStable();
    expect(field().querySelector('.error')).toBeNull();
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('hint and error together: both describe the control, hint first', async () => {
    host.hint.set('Минимум 8 символов');
    host.error.set('Слишком короткий пароль');
    await fixture.whenStable();
    const ids = describedBy();
    expect(ids).toHaveLength(2);
    expect(byId(ids[0])?.textContent).toBe('Минимум 8 символов');
    expect(byId(ids[1])?.textContent).toBe('Слишком короткий пароль');
  });

  it('every field has its own ids', async () => {
    host.hint.set('Подсказка');
    await fixture.whenStable();
    const textarea = root.querySelector('textarea')!;
    expect(textarea.id).not.toBe(input.id);
    expect(textarea.labels?.[0]?.textContent).toBe('Описание');
    // The hint of the first field describes only its own control.
    expect(textarea.hasAttribute('aria-describedby')).toBe(false);
    expect(field().querySelector('.hint')?.id).not.toBe(textarea.id);
  });
});
