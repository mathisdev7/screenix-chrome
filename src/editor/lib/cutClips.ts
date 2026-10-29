import type { CutClip } from "@/shared/settings";
import { freeSpanAt, sortedSpans, type Bounds } from "./clipSpans";

export { removeSpan as removeCutClip, spanAt as cutClipAt } from "./clipSpans";

export const DEFAULT_CUT_SECONDS = 2;

export function addCutClip(clips: readonly CutClip[], time: number, bounds: Bounds, id: string): CutClip[] | null {
  const span = freeSpanAt(clips, time, DEFAULT_CUT_SECONDS, bounds);
  if (!span) return null;
  return sortedSpans([...clips, { id, ...span }]);
}
