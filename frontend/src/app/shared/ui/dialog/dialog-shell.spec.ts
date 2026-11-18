import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogShell } from './dialog-shell';

@Component({
  imports: [DialogShell],
  template: `
    <tp-dialog-shell title="Без подвала"><p>Тело</p></tp-dialog-shell>
    <tp-dialog-shell title="С подвалом">
      <p>Тело</p>
      <button tpDialogFooter type="button">Отмена</button>
    </tp-dialog-shell>
  `,
})
class Host {}

describe('DialogShell', () => {
  let shells: HTMLElement[];

  beforeEach(async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    shells = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tp-dialog-shell'));
  });

  it('puts content into the body and tpDialogFooter elements into the footer', () => {
    const [, withFooter] = shells;
    expect(withFooter.querySelector('.body p')?.textContent).toBe('Тело');
    expect(withFooter.querySelector('.foot button')?.textContent).toBe('Отмена');
    expect(withFooter.querySelector('.body button')).toBeNull();
  });

  it('leaves the footer empty without footer content (hidden by :empty)', () => {
    expect(shells[0].querySelector('.foot')?.childElementCount).toBe(0);
    expect(shells[0].querySelector('.foot')?.textContent).toBe('');
  });

  it('outside a dialog: unique title ids, the close button does nothing', () => {
    const ids = shells.map((s) => s.querySelector('h2')!.id);
    expect(ids[0]).toMatch(/^tp-dialog-title-/);
    expect(ids[0]).not.toBe(ids[1]);
    expect(() => shells[0].querySelector<HTMLButtonElement>('.close')!.click()).not.toThrow();
  });
});
