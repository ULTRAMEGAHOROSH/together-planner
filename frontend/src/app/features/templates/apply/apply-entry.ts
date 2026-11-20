import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import type { IsoDate, Uuid } from '@core/api/models/common.models';
import { TemplatesApi } from '@core/api/templates-api';
import { SessionStore } from '@core/auth/session-store';
import { ToastService } from '@core/notify/toast-service';
import { ZoneClock } from '@core/time/zone-clock';
import { addDays, weekStartOf } from '@shared/time';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { openApplyTemplate } from './apply-dialog/apply-dialog';

export const NO_TEMPLATES_TEXT = 'Сначала создайте шаблон';

/**
 * Where «Применить шаблон» starts from (TPL-08, prototype `openApply`). From the schedule
 * (the toolbar, an empty week) it is the week on screen and any template: with no template
 * at all there is nothing to apply, so a toast says so and leads to the editor. From a
 * template (its card, its editor) it is that template and the next week.
 */
@Injectable({ providedIn: 'root' })
export class ApplyTemplateEntry {
  private readonly api = inject(TemplatesApi);
  private readonly dialogs = inject(DialogService);
  private readonly session = inject(SessionStore);
  private readonly clock = inject(ZoneClock);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** The week on screen; the template is chosen in the dialog (the first one to begin with). */
  openForWeek(weekStart: IsoDate): void {
    const workspace = this.session.workspace();
    if (workspace === null) {
      return;
    }
    this.api.list(workspace.id).subscribe({
      next: (templates) => (templates.length === 0 ? this.noTemplates() : this.open({ weekStart })),
      error: (error: unknown) => this.toast.error(error),
    });
  }

  /** This template, next week (the prototype's default for a template). */
  openForTemplate(templateId: Uuid): void {
    const zone = this.session.timeZone();
    if (zone === null) {
      return;
    }
    const thisWeek = weekStartOf(this.clock.todayIn(zone));
    this.open({ templateId, weekStart: addDays(thisWeek, 7) });
  }

  private open(data: { templateId?: Uuid; weekStart: IsoDate }): void {
    openApplyTemplate(this.dialogs, data).subscribe();
  }

  private noTemplates(): void {
    this.toast.show(NO_TEMPLATES_TEXT, {
      action: { label: 'Создать', run: () => void this.router.navigate(['/templates', 'new']) },
    });
  }
}
