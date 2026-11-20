import { Component, computed, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { messageFor } from '@core/error/error-messages';
import { Button } from '@shared/ui/button/button';
import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { ErrorState } from '@shared/ui/error-state/error-state';
import { Spinner } from '@shared/ui/spinner/spinner';
import { TemplateCard } from '../template-card/template-card';
import { TemplatesStore } from '../templates-store';

/**
 * `/templates` «Шаблоны недель» (TPL-02): the cards of T1, «Открыть» goes to the editor,
 * «Удалить» asks twice. The store loads and deletes; the page connects it to the router.
 */
@Component({
  selector: 'tp-templates-page',
  imports: [Button, EmptyState, ErrorState, Spinner, TemplateCard],
  providers: [TemplatesStore],
  templateUrl: './templates-page.html',
  styleUrl: './templates-page.scss',
})
export class TemplatesPage implements OnInit {
  protected readonly store = inject(TemplatesStore);
  private readonly router = inject(Router);

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

  protected open(id: string): void {
    void this.router.navigate(['/templates', id]);
  }
}
