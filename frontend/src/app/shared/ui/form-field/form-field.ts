import { Component, computed, Directive, inject, input } from '@angular/core';

let nextId = 1;

/**
 * Label, hint and error of one form control. The control inside is marked `tpControl`:
 * it gets the id for the label, `aria-describedby` (hint and error) and `aria-invalid`.
 * The error text comes from the caller (CORE-12 `controlErrorMessage`), and only when it
 * should be shown: after the first submit or blur (FD-83).
 *
 * ```html
 * <tp-form-field label="Email" [error]="emailError()">
 *   <input tpControl type="email" formControlName="email" />
 * </tp-form-field>
 * ```
 */
@Component({
  selector: 'tp-form-field',
  templateUrl: './form-field.html',
  styleUrl: './form-field.scss',
})
export class FormField {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);

  private readonly id = `tp-field-${nextId++}`;
  readonly controlId = this.id;
  protected readonly hintId = `${this.id}-hint`;
  protected readonly errorId = `${this.id}-error`;

  readonly invalid = computed(() => !!this.error());
  readonly describedBy = computed(
    () =>
      [this.hint() && this.hintId, this.error() && this.errorId].filter(Boolean).join(' ') || null,
  );
}

/** The input, select or textarea of a {@link FormField}. Looks: `.tp-control` (styles/_controls.scss). */
@Directive({
  selector: '[tpControl]',
  host: {
    class: 'tp-control',
    '[id]': 'field.controlId',
    '[attr.aria-describedby]': 'field.describedBy()',
    '[attr.aria-invalid]': "field.invalid() ? 'true' : null",
  },
})
export class FormFieldControl {
  protected readonly field = inject(FormField);
}
