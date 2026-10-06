import { lazy, Suspense, useState } from "react";
import { EggErrorBoundary } from "./EggErrorBoundary.tsx";
import type { DinoGameProps } from "./DinoGame.tsx";

/**
 * The waiting game, code-split away from the surfaces that host it.
 *
 * The game is the one egg every waiting surface pulls in — chat, buddy,
 * onboarding, ingestion and the summary drawer all import it — which used to
 * put its chunk on the app's boot path through the always-mounted buddy dock.
 * Behind `lazy()` the chunk arrives with the first open instead — or with the
 * phones-only hint that invites it, which preloads the import so the tap
 * rarely meets a cold chunk. The fallback holds the box the game is about to
 * take (the 220 px canvas plus its border), so opening it never shifts the
 * layout around it; it is only ever visible for the moment the chunk spends
 * on the wire. A chunk that fails to arrive (a stale deploy's missing hashed
 * file, a dropped connection) is caught by {@link EggErrorBoundary}: the
 * surface says so, stays closable, and offers a retry — which is a real new
 * import, because `React.lazy` caches a rejection for the page's lifetime
 * and a module-level lazy would turn one dropped fetch into a dead game
 * until a reload.
 */
export function DinoGameLazy(props: DinoGameProps) {
  // The lazy lives in state, not in a memo inside the suspending child: a
  // render that suspends is discarded and rebuilt, so anything built during
  // it would be rebuilt too — every suspense retry would start another
  // import(). Held here and rebuilt only by a retry, one open means one
  // import, and the retry button is what gets a fresh lazy past the cached
  // rejection.
  const [Game, setGame] = useState(makeLazyGame);
  return (
    <EggErrorBoundary
      label="Mini dino game"
      onClose={props.onExit}
      ownsClose
      onRetry={() => setGame(() => makeLazyGame())}
    >
      <Suspense
        fallback={
          <div
            className="h-[222px] w-full rounded-2xl border border-app-border bg-app-surface-muted"
            aria-hidden="true"
          />
        }
      >
        <Game {...props} />
      </Suspense>
    </EggErrorBoundary>
  );
}

/** The chunk's lazy component — built fresh for every attempt, because
 * `React.lazy` caches a rejection for the page's lifetime. */
function makeLazyGame() {
  return lazy(() => import("./DinoGame").then((module) => ({ default: module.DinoGame })));
}
