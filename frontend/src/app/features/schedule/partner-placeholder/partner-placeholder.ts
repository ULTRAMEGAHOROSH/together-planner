import { Component } from '@angular/core';
import { InviteCard } from '@features/onboarding';

/**
 * The right half of the board while the partner has not joined (SHELL-04): the same two
 * rows as a person panel (subgrid), a header in the colour of seat 2 and the invite card
 * under it. The card waits for «Получить код»: just looking at it must not cancel a code
 * that was already sent.
 */
@Component({
  selector: 'tp-partner-placeholder',
  imports: [InviteCard],
  template: `
    <div class="head"><span class="title">Партнёр ещё не присоединился</span></div>
    <div class="body">
      <p class="lead">Здесь появится его расписание. Пригласите партнёра по коду или ссылке.</p>
      <tp-invite-card [issueOnStart]="false" />
    </div>
  `,
  styleUrl: './partner-placeholder.scss',
})
export class PartnerPlaceholder {}
