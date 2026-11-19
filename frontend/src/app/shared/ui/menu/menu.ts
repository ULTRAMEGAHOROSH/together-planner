// Drop-down menu on top of CDK Menu (FD-40: CDK Overlay underneath). CDK gives the roles
// (`menu`, `menuitem`, `aria-haspopup`, `aria-expanded`), arrow keys, Home/End, typeahead,
// Esc and click outside; focus goes back to the trigger when the menu closes.
//
// <button type="button" [tpMenuTriggerFor]="menu">…</button>
// <ng-template #menu>
//   <tp-menu aria-label="…">
//     <button tpMenuItem (triggered)="logout()">Выйти</button>
//   </tp-menu>
// </ng-template>
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import type { ConnectedPosition } from '@angular/cdk/overlay';
import { Component, Directive, inject, input } from '@angular/core';

/** Under the trigger, right edges aligned (prototype); above it if there is no room below. */
const BELOW_END: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
];

/** Opens the `<tp-menu>` of the given template: click, Enter, Space or ↓ / ↑. */
@Directive({
  selector: '[tpMenuTriggerFor]',
  hostDirectives: [{ directive: CdkMenuTrigger, inputs: ['cdkMenuTriggerFor: tpMenuTriggerFor'] }],
})
export class MenuTrigger {
  constructor() {
    inject(CdkMenuTrigger, { self: true }).menuPosition = BELOW_END;
  }
}

/** The menu panel. Content that is not `tpMenuItem` (a header) is skipped by the keys. */
@Component({
  selector: 'tp-menu',
  hostDirectives: [CdkMenu],
  template: '<ng-content />',
  styleUrl: './menu.scss',
})
export class Menu {}

export type MenuItemVariant = 'default' | 'danger';

/** A menu item on a native button; `triggered` fires on click, Enter or Space and closes the menu. */
@Component({
  // A component on the native element, like `button[tpButton]`.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[tpMenuItem]',
  hostDirectives: [{ directive: CdkMenuItem, outputs: ['cdkMenuItemTriggered: triggered'] }],
  template: '<ng-content />',
  styleUrl: './menu-item.scss',
  host: { type: 'button', '[class.danger]': "variant() === 'danger'" },
})
export class MenuItem {
  readonly variant = input<MenuItemVariant>('default');
}
