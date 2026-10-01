import type { KnowledgeGapOverview } from "../../knowledge-gaps/types";

/**
 * Whether the knowledge gaps already reflect the newest import — and so whether asking the AI to
 * rescan them in an analysis would find anything new.
 *
 * The backend rescans the gaps on its own once an import is indexed, so normally they are current
 * and a manual rescan only pays for the same answer again. They fall behind when that automatic
 * rescan failed or is switched off, which is when the option is worth offering.
 */
export type GapScanState =
  /** The gaps or the sources could not be read: nothing to say either way. */
  | { kind: "unknown" }
  /** A rescan after an import is already running. */
  | { kind: "refreshing" }
  /** Scanned after the newest import, or nothing was imported yet. */
  | { kind: "current"; scannedAt: string | null }
  /** An import is newer than the last scan, or there never was a scan. */
  | { kind: "behind"; scannedAt: string | null };

export function gapScanState(
  overview: KnowledgeGapOverview | null,
  sources: readonly { lastRunAt: string | null }[] | null,
): GapScanState {
  if (!overview || !sources) return { kind: "unknown" };
  if (overview.refreshing) return { kind: "refreshing" };

  const scannedAt = overview.refreshedAt ?? null;
  const importedAt =
    sources
      .map((source) => source.lastRunAt)
      .filter((value): value is string => value !== null)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .at(-1) ?? null;

  if (importedAt === null) return { kind: "current", scannedAt };
  if (scannedAt === null) return { kind: "behind", scannedAt };
  return new Date(scannedAt).getTime() >= new Date(importedAt).getTime()
    ? { kind: "current", scannedAt }
    : { kind: "behind", scannedAt };
}
