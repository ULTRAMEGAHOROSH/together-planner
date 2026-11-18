import { Component, input, output } from '@angular/core';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';

/**
 * A screen could not load (network, 5xx: decisions §9): the message and «Повторить».
 * The text comes from the caller (`messageFor(error)`); `retry` asks the store to load again.
 */
@Component({
  selector: 'tp-error-state',
  imports: [Button, Icon],
  templateUrl: './error-state.html',
  styleUrl: './error-state.scss',
  host: { role: 'alert' },
})
export class ErrorState {
  readonly text = input.required<string>();
  readonly retry = output();
}
