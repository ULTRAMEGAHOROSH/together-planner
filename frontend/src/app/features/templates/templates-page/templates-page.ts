import { Component, computed, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '@core/auth/session-store';
import { ZoneClock } from '@core/time/zone-clock';
import { weekStartOf } from '@shared/time';
import { DialogService } from '@shared/ui/dialog/dialog-service';
import { messageFor } from '@core/error/error-messages';
import { Button } from '@shared/ui/button/button';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Spinner } from '@shared/ui/spinner/spinner';
import { ApplyTemplateEntry } from '../apply/apply-entry';
import { HistoryList } from '../history-list/history-list';
import { openSaveWeek } from '../save-week/save-week-dialog';
import { TemplateCard } from '../template-card/template-card';
import { TemplatesStore } from '../templates-store';

/**
 * `/templates` «Шаблоны недель» (TPL-02): the cards of T1, «Открыть» goes to the editor,
 * «Удалить» asks twice. The store loads and deletes; the page connects it to the router.
 */
@Component({
  selector: 'tp-templates-page',
  imports: [Button, EmptyState, ErrorState, HistoryList, Spinner, TemplateCard],
  providers: [TemplatesStore],
  templateUrl: './templates-page.html',
  styleUrl: './templates-page.scss',
})
export class TemplatesPage implements OnInit {
  protected readonly store = inject(TemplatesStore);
  private readonly router = inject(Router);
  private readonly applier = inject(ApplyTemplateEntry);
  private readonly dialogs = inject(DialogService);
  private readonly session = inject(SessionStore);
  private readonly clock = inject(ZoneClock);

  protected readonly errorText = computed(() => messageFor(this.store.error()));
  /** Nothing to show yet: the first load has not finished. */
  protected readonly firstLoad = computed(
    () => this.store.templates().length === 0 && ['idle', 'loading'].includes(this.store.status()),
  );
  protected readonly isEmpty = computed(
    () => this.store.status() === 'ready' && this.store.templates().length === 0,
  );

  ngOnInit(): void {
    this.store.load();
  }

  protected create(): void {
    void this.router.navigate(['/templates', 'new']);
  }

  /** «Сохранить неделю как шаблон»: the current week to begin with (TPL-12). */
  protected saveWeek(): void {
    const zone = this.session.timeZone();
    if (zone === null) {
      return;
    }
    openSaveWeek(this.dialogs, { weekStart: weekStartOf(this.clock.todayIn(zone)) }).subscribe();
  }

  protected apply(id: string): void {
    this.applier.openForTemplate(id);
  }

  protected open(id: string): void {
    void this.router.navigate(['/templates', id]);
  }
}
