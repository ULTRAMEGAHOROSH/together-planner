import { Component, computed, inject, input, output, signal } from '@angular/core';
import type { TemplateResponse } from '@core/api/models/template.models';
import { SessionStore } from '@core/auth/session-store';
import { seatColor, seatTint } from '@shared/domain';
import { weekShort } from '@shared/time';
import { Button } from '@shared/ui/button/button';
import { templateStats } from '../template-stats';

/**
 * A template of the list (TPL-02): name, description, who has how many events, when it
 * was applied last. «Удалить» asks twice: the first press turns the button into
 * «Точно удалить?», the second one emits `remove`; leaving the button takes it back.
 */
@Component({
  selector: 'tp-template-card',
  imports: [Button],
  templateUrl: './template-card.html',
  styleUrl: './template-card.scss',
})
export class TemplateCard {
  readonly template = input.required<TemplateResponse>();
  /** T5 of this template is running. */
  readonly deleting = input(false);
  readonly open = output();
  readonly remove = output();

  private readonly session = inject(SessionStore);
  protected readonly confirming = signal(false);

  protected readonly stats = computed(() =>
    templateStats(this.template().events, this.session.members()),
  );
  protected readonly chips = computed(() => {
    const { byMember, together } = this.stats();
    const chips = byMember.map(({ member, count }) => ({
      text: `${member.displayName} · ${count}`,
      color: seatColor(member.seat),
      background: seatTint(member.seat),
    }));
    // «вместе» is shown for a pair, or when the template has such events anyway.
    if (byMember.length > 1 || together > 0) {
      chips.push({
        text: `вместе · ${together}`,
        color: 'var(--tp-color-text-2)',
        background: 'var(--tp-color-surface-sunken)',
      });
    }
    return chips;
  });
  protected readonly appliedText = computed(() => {
    const last = this.template().lastApplication;
    return last === null
      ? 'Ещё не применялся'
      : `Последний раз: неделя ${weekShort(last.weekStart)}`;
  });

  protected askOrRemove(): void {
    if (!this.confirming()) {
      this.confirming.set(true);
      return;
    }
    this.confirming.set(false);
    this.remove.emit();
  }
}
