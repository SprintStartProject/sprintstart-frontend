import { useEffect, useState } from "react";
import { CheckCircle2, CircleDot, Layers, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { BlueprintGraphCanvas } from "../../blueprints/components/BlueprintGraphCanvas.tsx";
import {
  BlueprintNodeCard,
  type NodeAccent,
} from "../../blueprints/components/BlueprintNodeCard.tsx";
import {
  pathWindow,
  type PathWindowNode,
  type PathWindowState,
} from "../../onboarding/pathWindow.ts";
import { onboardingService } from "../../../services/onboardingService.ts";

/** What each state is called and wears. Never colour alone — every one carries a word and a glyph. */
const STATES: Record<
  PathWindowState,
  {
    label: string;
    accent: NodeAccent;
    variant: "success" | "brand" | "neutral";
    icon: typeof Layers;
  }
> = {
  done: { label: "Done", accent: "success", variant: "success", icon: CheckCircle2 },
  current: { label: "You are here", accent: "brand", variant: "brand", icon: CircleDot },
  ahead: { label: "Next", accent: "neutral", variant: "neutral", icon: CircleDot },
  locked: { label: "Locked", accent: "warning", variant: "neutral", icon: Lock },
};

/**
 * Where the hire stands in their path, as the two or three phases around them.
 *
 * The board says a great many true things about somebody's work and never this one. The path has a
 * page of its own and that page shows all of it — right for "what is coming", useless for "what
 * now", because the phase they are standing in is one of sixteen boxes on it.
 *
 * **A window, not a map.** See {@link pathWindow}: what had to happen, where they are, what that
 * opens. Drawn with the same canvas the PM authored the blueprint in, read-only, which is the
 * point — the run a hire is looking at *is* the shape somebody drew for them, and seeing it in the
 * same hand is what connects the two.
 *
 * **Silent when there is nothing to say.** A hire with no path yet is an ordinary state, not an
 * error: the strip renders nothing rather than an empty box or a message about a 404.
 */
export function BoardPathWindow() {
  const [window, setWindow] = useState<ReturnType<typeof pathWindow> | null>(null);

  useEffect(() => {
    let cancelled = false;

    void onboardingService
      .fetchPath()
      .then((path) => {
        if (!cancelled) setWindow(pathWindow(path));
      })
      // No path, or no reaching it: the board has plenty else to show, and a strip that cannot
      // say where somebody is should not say anything at all.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  if (!window || window.nodes.length === 0) return null;

  const current = window.nodes.find((node) => node.id === window.currentId);

  return (
    <section aria-label="Where you are in your path">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-app-text-muted">
          {current ? (
            <>
              You are in <span className="font-medium text-app-text">{current.title}</span>
              {current.progress.total > 0 ? (
                <>
                  {" "}
                  — {current.progress.done} of {current.progress.total} steps done
                </>
              ) : null}
              .
            </>
          ) : (
            "Where you are in your path."
          )}
        </p>
        <Link
          to="/onboarding"
          className="text-xs font-medium text-app-brand-text underline-offset-2 hover:underline"
        >
          See the whole path
        </Link>
      </div>

      {/*
        No box around it. A border and and a panel would make this a section of the page competing
        with the eleven cards below; what it is is a few nodes drawn on the board's own surface,
        and the nodes are the thing with edges on them.
      */}
      <div className="h-48">
        <BlueprintGraphCanvas<PathWindowNode>
          nodes={window.nodes}
          title=""
          description=""
          editable={false}
          height="fill"
          ariaLabel="Where you are in your path"
          emptyTitle="Nothing to show yet"
          onNodeClick={() => {}}
          onPositionChange={() => Promise.resolve()}
          onAddBlocker={() => Promise.resolve()}
          onRemoveBlocker={() => Promise.resolve()}
          renderNode={(node, cardProps) => {
            const state = STATES[node.state];
            return (
              <BlueprintNodeCard
                {...cardProps}
                title={node.title}
                kind={{ label: "Phase", icon: Layers }}
                accent={state.accent}
                status={{ label: state.label, variant: state.variant, icon: state.icon }}
                highlighted={node.id === window.currentId}
                // The ring around the glyph rather than a count on the line: how far through a
                // phase somebody is, is the one number this strip exists to show.
                progress={node.progress}
              />
            );
          }}
        />
      </div>
    </section>
  );
}
