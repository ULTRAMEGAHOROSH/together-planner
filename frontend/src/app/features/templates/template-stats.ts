// What a template card counts (TPL-02): events of each member alone, and events together.
import type { TemplateEventResponse } from '@core/api/models/template.models';
import type { MemberResponse } from '@core/api/models/workspace.models';

export interface TemplateStats {
  /** Events with exactly one participant, by seat (1, 2): each count under its member. */
  readonly byMember: readonly { readonly member: MemberResponse; readonly count: number }[];
  /** Events with both participants («вместе»). */
  readonly together: number;
}

/**
 * Counts the events of a template: those of one member alone (a member who is not in
 * `members` — the partner has not joined — has no row), and the shared ones apart.
 */
export function templateStats(
  events: readonly Pick<TemplateEventResponse, 'participantIds'>[],
  members: readonly MemberResponse[],
): TemplateStats {
  const together = events.filter((e) => e.participantIds.length > 1).length;
  const byMember = members.map((member) => ({
    member,
    count: events.filter(
      (e) => e.participantIds.length === 1 && e.participantIds[0] === member.userId,
    ).length,
  }));
  return { byMember, together };
}
