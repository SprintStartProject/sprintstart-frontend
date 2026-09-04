import type { CanvasPositions } from "./canvasLayout";

/**
 * Where the arrangement of a project's blueprint canvas is kept.
 *
 * Local storage, per project, and — like {@link ../cardBlueprintService} — a placeholder rather
 * than a judgement. The blueprints themselves are a team's decisions and belong on the server; so
 * does the picture the team drew of them, because a second PM opening the canvas should find the
 * arrangement the first one built and not a fresh grid.
 *
 * It is kept in its own module and its own key rather than folded into the blueprint rows for one
 * reason: a position is not part of what a blueprint *means*. Every consumer of a blueprint — the
 * generator, the preview, a hire's board — would have to carry two numbers it will never read, and
 * the endpoint that eventually stores blueprints would have to accept a write every time somebody
 * nudged a card.
 *
 * TODO(backend): `PUT /api/v1/onboarding/projects/{projectId}/card-blueprints/layout`, authorised
 * like the other PM surfaces. Until then the canvas is arranged per browser, which is fine for
 * agreeing the shape and not fine for a team.
 */
const STORAGE_VERSION = 1;

function storageKey(projectId: string): string {
  return `sprintstart:card-blueprint-canvas:${projectId}`;
}

type Stored = { version: number; positions: unknown };

/** One stored position, with anything that isn't a pair of numbers dropped rather than drawn. */
function toPosition(value: unknown): { x: number; y: number } | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.x !== "number" || typeof raw.y !== "number") return null;
  if (!Number.isFinite(raw.x) || !Number.isFinite(raw.y)) return null;

  return { x: raw.x, y: raw.y };
}

export const canvasPositionStore = {
  /**
   * The arrangement of a project's canvas. An unreadable or absent entry reads as "nothing placed
   * yet", which the canvas fills in — losing an arrangement is a nuisance, refusing to draw is not
   * an option.
   */
  read(projectId: string): CanvasPositions {
    try {
      const raw = window.localStorage.getItem(storageKey(projectId));
      if (!raw) return {};

      const parsed = JSON.parse(raw) as Stored;
      if (parsed?.version !== STORAGE_VERSION || typeof parsed.positions !== "object") return {};
      if (parsed.positions === null) return {};

      const positions: CanvasPositions = {};
      for (const [id, value] of Object.entries(parsed.positions as Record<string, unknown>)) {
        const position = toPosition(value);
        if (position) positions[id] = position;
      }

      return positions;
    } catch {
      return {};
    }
  },

  /** Writes the whole arrangement. Positions of blueprints that no longer exist are harmless. */
  write(projectId: string, positions: CanvasPositions): void {
    try {
      window.localStorage.setItem(
        storageKey(projectId),
        JSON.stringify({ version: STORAGE_VERSION, positions } satisfies Stored),
      );
    } catch {
      // A full or blocked storage costs the arrangement, never the session.
    }
  },
};
