// The one write path (ADR 0012, docs/sync.md): read, plan the difference, write it, read back.
export type { KeyboardImage, SlotTable } from "./image";
export type { StepKind, SyncStep } from "./plan";
export { plannedKeys, planSync, storedItems } from "./plan";
export type { SyncItem } from "./conflicts";
export { conflicts, itemsOf } from "./conflicts";
export type { ImageFeatures, ReadImage } from "./read";
export { readImage } from "./read";
export type { SyncResult } from "./write";
export { SyncStopped, syncTo, writePlan } from "./write";
