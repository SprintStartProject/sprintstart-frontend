import type { ComponentType, LazyExoticComponent } from "react";
import { lazy } from "react";

/**
 * Every modal easter egg the app knows about, in one registry.
 *
 * A "game egg" is `{ id, label, kind, component }`. The component is the
 * game itself and is loaded lazily so none of the game code ships in the
 * main bundle — the chunk is fetched the first time the egg is actually
 * opened. Adding a future game means one entry here plus one component
 * file; every trigger, page and test keeps addressing eggs by id.
 */

export type EggId = "game-2048" | "space-invaders";

type EggDefinition = {
  /** Human-readable name for aria labels and visible chrome. */
  label: string;
  /**
   * "canvas": React component owning its keyboard, draws its own score /
   * exit chrome and calls `onExit`. "iframe": self-contained page loaded
   * in an iframe; `EggModalShell` adds a header bar and Escape handling.
   */
  kind: "canvas" | "iframe";
  component: LazyExoticComponent<ComponentType<{ onExit: () => void }>>;
};

export const EGG_REGISTRY: Record<EggId, EggDefinition> = {
  "game-2048": {
    label: "2048",
    kind: "iframe",
    // Thin wrapper so the vanilla-JS page satisfies the shared game shape.
    // The page's own path lives in that wrapper, not here.
    component: lazy(() =>
      import("./components/Game2048Frame").then((m) => ({ default: m.Game2048Frame })),
    ),
  },
  "space-invaders": {
    label: "Space Invaders game",
    kind: "canvas",
    component: lazy(() =>
      import("./components/SpaceInvaders").then((m) => ({ default: m.SpaceInvaders })),
    ),
  },
};
