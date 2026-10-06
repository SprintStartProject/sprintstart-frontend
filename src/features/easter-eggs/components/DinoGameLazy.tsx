import { lazy, Suspense } from "react";
import { EggErrorBoundary } from "./EggErrorBoundary.tsx";
import type { DinoGameProps } from "./DinoGame.tsx";

const LazyDinoGame = lazy(() =>
  import("./DinoGame").then((module) => ({ default: module.DinoGame })),
);

/**
 * The waiting game, code-split away from the surfaces that host it.
 *
 * The game is the one egg every waiting surface pulls in — chat, buddy,
 * onboarding, ingestion and the summary drawer all import it — which used to
 * put its chunk on the app's boot path through the always-mounted buddy dock.
 * Behind `lazy()` the chunk arrives with the first open instead. The fallback
 * holds the box the game is about to take (the 220 px canvas plus its border),
 * so opening it never shifts the layout around it; it is only ever visible
 * for the moment the chunk spends on the wire. A chunk that fails to arrive
 * (a stale deploy's missing hashed file, a dropped connection) is caught by
 * {@link EggErrorBoundary}: the surface says so and stays closable instead
 * of the error unmounting its host.
 */
export function DinoGameLazy(props: DinoGameProps) {
  return (
    <EggErrorBoundary label="Mini dino game" onClose={props.onExit} ownsClose>
      <Suspense
        fallback={
          <div
            className="h-[222px] w-full rounded-2xl border border-app-border bg-app-surface-muted"
            aria-hidden="true"
          />
        }
      >
        <LazyDinoGame {...props} />
      </Suspense>
    </EggErrorBoundary>
  );
}
