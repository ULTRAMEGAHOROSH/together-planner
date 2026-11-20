import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { dialogElement, pressEscape, provideVisibleElements } from '@shared/ui/dialog/testing';
import { EventConflictDialog } from './event-conflict-dialog';

describe('EventConflictDialog', () => {
  let appRef: ApplicationRef;
  let result: true | undefined | null;

  const button = (text: string) =>
    Array.from(dialogElement()?.querySelectorAll('button') ?? []).find(
      (b) => b.textContent?.trim() === text,
    )!;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideVisibleElements()] });
    appRef = TestBed.inject(ApplicationRef);
    result = null;
    TestBed.inject(DialogService)
      .open<true>(EventConflictDialog, undefined, { size: 'sm' })
      .subscribe((r) => (result = r));
    await appRef.whenStable();
  });

  it('says who changed it and offers to load the current version', () => {
    expect(dialogElement()!.querySelector('h2')?.textContent?.trim()).toBe(
      'Партнёр изменил это событие',
    );
    expect(button('Загрузить актуальную версию')).toBeDefined();
    expect(document.activeElement).toBe(button('Отмена'));
  });

  it('«Загрузить актуальную версию» closes with true', async () => {
    button('Загрузить актуальную версию').click();
    await appRef.whenStable();

    expect(result).toBe(true);
  });

  it('«Отмена» and Esc close without a result', async () => {
    button('Отмена').click();
    await appRef.whenStable();
    expect(result).toBeUndefined();

    result = null;
    TestBed.inject(DialogService)
      .open<true>(EventConflictDialog, undefined, { size: 'sm' })
      .subscribe((r) => (result = r));
    await appRef.whenStable();
    pressEscape();
    await appRef.whenStable();
    expect(result).toBeUndefined();
  });
});
