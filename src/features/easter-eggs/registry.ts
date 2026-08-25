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

/** Lazy-loaded: the endless runner (chunk fetched on first open). */
const DinoGame = lazy(() =>
  import("../chatbot/components/DinoGame").then((m) => ({ default: m.DinoGame })),
);

/** Lazy-loaded: Space Invaders (chunk fetched on first open). */
const SpaceInvaders = lazy(() =>
  import("./components/SpaceInvaders").then((m) => ({ default: m.SpaceInvaders })),
);

export type EggId = "dino" | "game-2048" | "space-invaders";

type EggDefinition = {
  /** Human-readable name for aria labels and visible chrome. */
  label: string;
  /**
   * "canvas": React component owning its keyboard, draws its own score /
   * exit chrome and calls `onExit`. "iframe": self-contained page loaded
   * in an iframe; `EggModalShell` adds a header bar and Escape handling.
   */
  kind: "canvas" | "iframe";
  /** Where an iframe game lives under `public/`. */
  iframeSrc?: string;
  component: LazyExoticComponent<ComponentType<{ onExit: () => void }>>;
};

export const EGG_REGISTRY: Record<EggId, EggDefinition> = {
  dino: { label: "Dino game", kind: "canvas", component: DinoGame },
  "game-2048": {
    label: "2048",
    kind: "iframe",
    iframeSrc: "/easter-eggs/2048.html",
    // Thin wrapper so the vanilla-JS page satisfies the shared game shape.
    component: lazy(() =>
      import("./components/Game2048Frame").then((m) => ({ default: m.Game2048Frame })),
    ),
  },
  "space-invaders": {
    label: "Space Invaders game",
    kind: "canvas",
    component: SpaceInvaders,
  },
};
