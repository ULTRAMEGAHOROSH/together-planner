import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmptyState } from './empty-state';

@Component({
  imports: [EmptyState],
  template: `
    <tp-empty-state id="with" text="На эту неделю пока ничего нет.">
      <button type="button">Применить шаблон</button>
    </tp-empty-state>
    <tp-empty-state id="without" text="Шаблонов пока нет." />
  `,
})
class Host {}

describe('EmptyState', () => {
  it('shows the text and the projected actions', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const withActions = root.querySelector('#with')!;
    expect(withActions.querySelector('p')?.textContent).toBe('На эту неделю пока ничего нет.');
    expect(withActions.querySelector('.actions button')?.textContent).toBe('Применить шаблон');

    const without = root.querySelector('#without')!;
    expect(without.querySelector('p')?.textContent).toBe('Шаблонов пока нет.');
    expect(without.querySelector('.actions')?.childNodes.length).toBe(0);
  });
});
