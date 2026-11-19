import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Menu, MenuItem, MenuTrigger } from './menu';

@Component({
  imports: [Menu, MenuItem, MenuTrigger],
  template: `
    <button type="button" class="trigger" [tpMenuTriggerFor]="menu">Меню</button>
    <ng-template #menu>
      <tp-menu aria-label="Действия">
        <p class="head">Заголовок</p>
        <button tpMenuItem (triggered)="picked.push('first')">Первый</button>
        <button tpMenuItem variant="danger" (triggered)="picked.push('second')">Второй</button>
      </tp-menu>
    </ng-template>
  `,
})
class Host {
  readonly picked: string[] = [];
}

describe('tp-menu', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  afterEach(() => document.querySelector('.cdk-overlay-container')?.remove());

  const trigger = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.trigger')!;
  const menu = () => document.querySelector<HTMLElement>('tp-menu');
  const items = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[tpMenuItem]'));
  // CDK Menu reads the legacy `keyCode`, so the events carry it next to `key`.
  const KEY_CODES: Record<string, number> = { Enter: 13, Escape: 27, End: 35, ArrowDown: 40 };
  const key = async (target: Element, key: string) => {
    const init = { key, keyCode: KEY_CODES[key], bubbles: true, cancelable: true };
    target.dispatchEvent(new KeyboardEvent('keydown', init));
    await fixture.whenStable();
  };
  async function click(el: HTMLElement) {
    el.click();
    await fixture.whenStable();
  }

  it('the trigger announces a menu; a click opens it with menu roles', async () => {
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(menu()).toBeNull();

    await click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(menu()?.getAttribute('role')).toBe('menu');
    expect(menu()?.getAttribute('aria-label')).toBe('Действия');
    expect(trigger().getAttribute('aria-controls')).toBe(menu()?.id);
    expect(items().map((b) => [b.textContent?.trim(), b.getAttribute('role'), b.type])).toEqual([
      ['Первый', 'menuitem', 'button'],
      ['Второй', 'menuitem', 'button'],
    ]);
    expect(items()[1].classList).toContain('danger');
    expect(items()[0].classList).not.toContain('danger');
  });

  it('keyboard: ↓ opens on the first item, arrows move, the header is skipped, Esc returns focus', async () => {
    trigger().focus();
    await key(trigger(), 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    await key(items()[0], 'ArrowDown');
    expect(document.activeElement).toBe(items()[1]);
    await key(items()[1], 'ArrowDown'); // wraps over the header
    expect(document.activeElement).toBe(items()[0]);
    await key(items()[0], 'End');
    expect(document.activeElement).toBe(items()[1]);

    await key(items()[1], 'Escape');
    expect(menu()).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('an item fires `triggered` and closes the menu (click and Enter)', async () => {
    await click(trigger());
    await click(items()[1]);
    expect(fixture.componentInstance.picked).toEqual(['second']);
    expect(menu()).toBeNull();

    trigger().focus();
    await key(trigger(), 'ArrowDown');
    await key(items()[0], 'Enter');
    expect(fixture.componentInstance.picked).toEqual(['second', 'first']);
    expect(menu()).toBeNull();
  });

  it('a click outside closes it', async () => {
    await click(trigger());
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(menu()).toBeNull();
  });
});
