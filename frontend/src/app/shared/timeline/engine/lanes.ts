import type { LaidOutSegment, Segment } from './model';

/**
 * Lanes for the segments of ONE day of one panel (FD-54, prototype `layoutDay`):
 * sort by start, longer first on a tie, then by event id — so the result does not depend
 * on the input order; a cluster ends when the next start is ≥ the latest end so far
 * (touching intervals do not overlap); in a cluster each segment takes the first lane
 * that is free by its start. Every segment of a cluster gets the cluster's lane count.
 * Returns the segments in that sorted order.
 */
export function assignLanes(segments: readonly Segment[]): LaidOutSegment[] {
  const sorted = [...segments].sort(compareSegments);
  const laidOut: LaidOutSegment[] = [];
  let cluster: { segment: Segment; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const laneCount = laneEnds.length;
    for (const { segment, lane } of cluster) laidOut.push({ ...segment, lane, laneCount });
    cluster = [];
    laneEnds = [];
  };

  for (const segment of sorted) {
    if (segment.start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((end) => end <= segment.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = segment.end;
    cluster.push({ segment, lane });
    clusterEnd = Math.max(clusterEnd, segment.end);
  }
  flush();
  return laidOut;
}

function compareSegments(a: Segment, b: Segment): number {
  return (
    a.start - b.start || b.end - b.start - (a.end - a.start) || compareIds(a.event.id, b.event.id)
  );
}

/** Plain code-unit order: the same in every locale, unlike localeCompare. */
function compareIds(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}
