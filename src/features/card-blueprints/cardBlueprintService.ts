import type { CardBlueprint, CardBlueprintDraft } from "./types";

/**
 * Where a project's card blueprints are kept.
 *
 * Local storage, per project, and this one is a *placeholder* rather than a considered trade-off —
 * unlike the board's own local layers, which are one hire's preferences about one machine. These
 * are a team's decisions, authored by a PM and consumed by every hire on the project, so they
 * belong on the server and nowhere else. Kept here so the shape can be agreed and the screens
 * exercised before the endpoints exist.
 *
 * TODO(backend): `GET/POST/PUT/DELETE /api/v1/onboarding/projects/{projectId}/card-blueprints`,
 * authorised the way the other PM surfaces are (`@projectAuth.canAccessProject`). The functions
 * below are already async and already fail loudly, so the swap is one file. Until then, blueprints
 * a PM writes are visible only in the browser they were written in — which is fine for agreeing the
 * model and not fine for anything else.
 */
const STORAGE_VERSION = 1;

function storageKey(projectId: string): string {
  return `sprintstart:card-blueprints:${projectId}`;
}

type Stored = {
  version: number;
  blueprints: unknown;
};

/** One stored blueprint, with anything unrecognised dropped rather than trusted. */
function toBlueprint(value: unknown): CardBlueprint | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.title !== "string") return null;

  return {
    id: raw.id,
    title: raw.title,
    description: typeof raw.description === "string" ? raw.description : "",
    items: Array.isArray(raw.items)
      ? raw.items.filter((i): i is string => typeof i === "string")
      : [],
    // "NEXT" is a blueprint written when the board had three stages; it meant "not now", which is
    // what "LATER" means.
    stage: raw.stage === "NEXT" || raw.stage === "LATER" ? "LATER" : "NOW",
    roleIds: Array.isArray(raw.roleIds)
      ? raw.roleIds.filter((i): i is string => typeof i === "string")
      : [],
    position: typeof raw.position === "number" ? raw.position : 0,
    afterId: typeof raw.afterId === "string" ? raw.afterId : null,
  };
}

function read(projectId: string): CardBlueprint[] {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return [];

    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.blueprints)) return [];

    return parsed.blueprints
      .map(toBlueprint)
      .filter((blueprint): blueprint is CardBlueprint => blueprint !== null)
      .sort((a, b) => a.position - b.position);
  } catch {
    return [];
  }
}

function write(projectId: string, blueprints: CardBlueprint[]): void {
  window.localStorage.setItem(
    storageKey(projectId),
    JSON.stringify({ version: STORAGE_VERSION, blueprints } satisfies Stored),
  );
}

export const cardBlueprintService = {
  /**
   * Every card blueprint on a project, in the order the cards will be created.
   *
   * @param projectId The project the blueprints belong to.
   */
  list(projectId: string): Promise<CardBlueprint[]> {
    return Promise.resolve(read(projectId));
  },

  /**
   * Writes a blueprint, creating it when `id` is null and replacing it otherwise.
   *
   * A new blueprint goes to the end: it was written last, and inserting it anywhere else would be
   * this function guessing at an order the PM has a control for.
   *
   * @returns The blueprint as stored, with its id and position filled in.
   */
  save(projectId: string, id: string | null, draft: CardBlueprintDraft): Promise<CardBlueprint> {
    const blueprints = read(projectId);

    if (id) {
      const existing = blueprints.find((blueprint) => blueprint.id === id);
      if (!existing) {
        return Promise.reject(new Error(`No card blueprint ${id} on project ${projectId}`));
      }

      const updated = { ...existing, ...draft };
      write(
        projectId,
        blueprints.map((blueprint) => (blueprint.id === id ? updated : blueprint)),
      );

      return Promise.resolve(updated);
    }

    const created: CardBlueprint = {
      ...draft,
      id: `bp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      position: blueprints.length,
    };
    write(projectId, [...blueprints, created]);

    return Promise.resolve(created);
  },

  /**
   * Removes a blueprint, and unhooks anything that was waiting on it.
   *
   * A dangling `afterId` would leave a card blocked by a blueprint that no longer exists, which is
   * a block nobody can clear — so the removal takes the edge with it.
   */
  remove(projectId: string, id: string): Promise<void> {
    const blueprints = read(projectId)
      .filter((blueprint) => blueprint.id !== id)
      .map((blueprint) => (blueprint.afterId === id ? { ...blueprint, afterId: null } : blueprint));

    write(
      projectId,
      blueprints.map((blueprint, index) => ({ ...blueprint, position: index })),
    );

    return Promise.resolve();
  },

  /** Puts the blueprints in this order. Sends the whole order, the way the board's reorder does. */
  reorder(projectId: string, ids: string[]): Promise<void> {
    const byId = new Map(read(projectId).map((blueprint) => [blueprint.id, blueprint]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((blueprint): blueprint is CardBlueprint => blueprint !== undefined)
      .map((blueprint, index) => ({ ...blueprint, position: index }));

    write(projectId, ordered);

    return Promise.resolve();
  },
};
