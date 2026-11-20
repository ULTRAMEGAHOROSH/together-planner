import type { MemberResponse } from '@core/api/models/workspace.models';
import { TEMPLATE_CREATED, WEEK } from '@core/api/models/testing/samples';
import { templateStats } from './template-stats';

const [FIRST, SECOND] = WEEK.members as unknown as readonly MemberResponse[];

describe('templateStats (TPL-02)', () => {
  it('counts events of each member alone and the shared ones apart', () => {
    const stats = templateStats(TEMPLATE_CREATED.events, [FIRST, SECOND]);
    const counts = stats.byMember.map((m) => [m.member.userId, m.count]);
    expect(counts).toEqual([
      [FIRST.userId, 1],
      [SECOND.userId, 1],
    ]);
    expect(stats.together).toBe(1);
  });

  it('a shared event is not counted for either member', () => {
    const shared = { participantIds: [FIRST.userId, SECOND.userId] };
    const stats = templateStats([shared, shared], [FIRST, SECOND]);
    expect(stats.byMember.map((m) => m.count)).toEqual([0, 0]);
    expect(stats.together).toBe(2);
  });

  it('has no row for a partner who has not joined', () => {
    const stats = templateStats(TEMPLATE_CREATED.events, [FIRST]);
    expect(stats.byMember).toHaveLength(1);
  });

  it('an empty template is all zeros', () => {
    const stats = templateStats([], [FIRST, SECOND]);
    expect(stats.byMember.map((m) => m.count)).toEqual([0, 0]);
    expect(stats.together).toBe(0);
  });
});
