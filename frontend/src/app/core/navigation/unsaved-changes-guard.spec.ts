import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { of } from 'rxjs';
import { type HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes-guard';

describe('unsavedChangesGuard (TPL-04)', () => {
  const run = (page: HasUnsavedChanges) =>
    TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(
        page,
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

  it('asks the page and passes its answer on', () => {
    expect(run({ confirmLeave: () => true })).toBe(true);
    expect(run({ confirmLeave: () => false })).toBe(false);
    const answer = of(true);
    expect(run({ confirmLeave: () => answer })).toBe(answer);
  });
});
