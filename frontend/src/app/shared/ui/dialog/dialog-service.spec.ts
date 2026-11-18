import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ApplicationRef, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog-service';
import { DialogShell } from './dialog-shell';
import { dialogElement, pressEscape, provideVisibleElements } from './testing';

@Component({
  selector: 'tp-sample-dialog',
  imports: [DialogShell],
  template: `
    <tp-dialog-shell title="Новое событие">
      <input aria-label="Название" [value]="data.title" />
      <input aria-label="Описание" cdkFocusInitial />
      <button tpDialogFooter type="button" (click)="ref.close('saved')">Сохранить</button>
    </tp-dialog-shell>
  `,
})
class SampleDialog {
  protected readonly data = inject<{ title: string }>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<string>>(DialogRef);
}

@Component({
  selector: 'tp-opener',
  template: `<button type="button" id="opener" (click)="open()">Открыть</button>`,
})
class Opener {
  readonly dialogs = inject(DialogService);
  result: string | undefined | null = null;
  closed = false;

  open(): void {
    this.dialogs
      .open<string>(SampleDialog, { title: 'Ужин' })
      .subscribe({ next: (r) => (this.result = r), complete: () => (this.closed = true) });
  }
}

describe('DialogService', () => {
  let opener: Opener;
  let appRef: ApplicationRef;

  const button = (text: string) =>
    Array.from(dialogElement()?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === text || b.getAttribute('aria-label') === text,
    );

  async function openFromButton(): Promise<HTMLButtonElement> {
    const fixture = TestBed.createComponent(Opener);
    opener = fixture.componentInstance;
    await fixture.whenStable();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    trigger.focus();
    trigger.click();
    await appRef.whenStable();
    return trigger;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideVisibleElements()] });
    appRef = TestBed.inject(ApplicationRef);
  });

  it('renders the component with data inside the shell, labelled by its title', async () => {
    await openFromButton();
    const dialog = dialogElement()!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const title = dialog.querySelector('h2')!;
    expect(title.textContent?.trim()).toBe('Новое событие');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(dialog.querySelector<HTMLInputElement>('input')!.value).toBe('Ужин');
    expect(document.querySelector('.tp-dialog-panel.tp-dialog-panel--md')).not.toBeNull();
    expect(document.querySelector('.tp-dialog-backdrop')).not.toBeNull();
  });

  it('every dialog gets its own title id', async () => {
    const dialogs = TestBed.inject(DialogService);
    dialogs.open(SampleDialog, { title: 'A' });
    dialogs.open(SampleDialog, { title: 'B' }, { size: 'lg' });
    await appRef.whenStable();
    const ids = Array.from(document.querySelectorAll('.cdk-dialog-container h2')).map((h) => h.id);
    expect(new Set(ids).size).toBe(2);
    expect(document.querySelector('.tp-dialog-panel--lg')).not.toBeNull();
  });

  it('Esc closes the dialog with undefined and returns focus to the opener', async () => {
    const trigger = await openFromButton();
    expect(document.activeElement).not.toBe(trigger);
    pressEscape();
    await appRef.whenStable();
    expect(dialogElement()).toBeNull();
    expect(opener.result).toBeUndefined();
    expect(opener.closed).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('a click outside (backdrop) closes with undefined', async () => {
    await openFromButton();
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    await appRef.whenStable();
    expect(dialogElement()).toBeNull();
    expect(opener.result).toBeUndefined();
  });

  it('the close button of the shell closes with undefined', async () => {
    await openFromButton();
    button('Закрыть')!.click();
    await appRef.whenStable();
    expect(dialogElement()).toBeNull();
    expect(opener.result).toBeUndefined();
  });

  it('the component closes with its result', async () => {
    await openFromButton();
    button('Сохранить')!.click();
    await appRef.whenStable();
    expect(opener.result).toBe('saved');
    expect(opener.closed).toBe(true);
  });

  it('focus starts on the element with cdkFocusInitial', async () => {
    await openFromButton();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Описание');
  });

  it('Tab does not leave the dialog: the trap sends focus back inside', async () => {
    await openFromButton();
    const dialog = dialogElement()!;
    const [start, end] = Array.from(
      dialog.parentElement!.querySelectorAll<HTMLElement>('.cdk-focus-trap-anchor'),
    );
    // Tab past the last element lands on the end anchor → back to the first element.
    end.focus();
    expect(document.activeElement).toBe(button('Закрыть'));
    // Shift+Tab before the first element lands on the start anchor → to the last one.
    start.focus();
    expect(document.activeElement).toBe(button('Сохранить'));
  });
});
