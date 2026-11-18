import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { dialogElement, pressEscape, provideVisibleElements } from '@shared/ui/dialog/testing';
import { openConfirm } from './confirm-dialog';

describe('ConfirmDialog', () => {
  let appRef: ApplicationRef;
  let result: true | undefined | null;

  const button = (text: string) =>
    Array.from(dialogElement()?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === text,
    );

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideVisibleElements()] });
    appRef = TestBed.inject(ApplicationRef);
    result = null;
    openConfirm(TestBed.inject(DialogService), {
      title: 'Удалить шаблон?',
      text: 'События, уже созданные из него, останутся на своих неделях.',
      confirmLabel: 'Удалить',
    }).subscribe((r) => (result = r));
    await appRef.whenStable();
  });

  it('shows title, text and both buttons in a small dialog', () => {
    const dialog = dialogElement()!;
    expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Удалить шаблон?');
    expect(dialog.querySelector('p')?.textContent).toContain('останутся на своих неделях');
    expect(button('Отмена')).toBeDefined();
    expect(button('Удалить')?.classList).toContain('danger');
    expect(document.querySelector('.tp-dialog-panel--sm')).not.toBeNull();
  });

  it('confirm returns true', async () => {
    button('Удалить')!.click();
    await appRef.whenStable();
    expect(result).toBe(true);
    expect(dialogElement()).toBeNull();
  });

  it('cancel and Esc return undefined', async () => {
    button('Отмена')!.click();
    await appRef.whenStable();
    expect(result).toBeUndefined();

    result = null;
    openConfirm(TestBed.inject(DialogService), {
      title: 'Т',
      text: 'Т',
      confirmLabel: 'Да',
      cancelLabel: 'Нет',
    }).subscribe((r) => (result = r));
    await appRef.whenStable();
    expect(button('Нет')).toBeDefined();
    pressEscape();
    await appRef.whenStable();
    expect(result).toBeUndefined();
  });

  it('focus starts on «Отмена», not on the dangerous action', () => {
    expect(document.activeElement).toBe(button('Отмена'));
  });
});
