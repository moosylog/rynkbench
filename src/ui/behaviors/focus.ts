// "Open in editor" from the Behavior Library: which behavior the editor screen
// should show when it opens. The library sets it and switches screens; the
// screen takes it once, when it mounts.

import type { LibraryKind } from "./library";

/** A slot to open, or "new" to start a new one in the first free slot. */
export type BehaviorFocus = number | "new";

let pending: { kind: LibraryKind; focus: BehaviorFocus } | null = null;

export function setBehaviorFocus(kind: LibraryKind, focus: BehaviorFocus): void {
  pending = { kind, focus };
}

/** The focus for this kind's screen, once: a second call returns null. */
export function takeBehaviorFocus(kind: string): BehaviorFocus | null {
  if (pending?.kind !== kind) return null;
  const { focus } = pending;
  pending = null;
  return focus;
}
