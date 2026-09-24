import { useEffect, useId, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, CircleDot, Layers, Lock, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button.tsx";
import { Collapsible } from "../../../components/ui/Collapsible.tsx";
import { readPathWindowOpen, writePathWindowOpen } from "../layout/pathWindowFold.ts";
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
 *
 * **It folds, and the sentence stays.** A graph worth reading is a graph with room, and this one
 * takes a good share of a board somebody is otherwise working down. Folded, the line above it is
 * still there — and that line already answers "where am I"; the picture is the elaboration. The
 * fold is remembered per board, see {@link readPathWindowOpen}.
 */
export function BoardPathWindow({
  boardId,
  onRemove,
}: {
  boardId: string;
  /** Takes the strip off this board altogether. The way back is the board's own rail. */
  onRemove: () => void;
}) {
  const navigate = useNavigate();
  const [where, setWhere] = useState<ReturnType<typeof pathWindow> | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const panelId = useId();

  // Read during render rather than in an effect, the way the board reads its other folds: the
  // state has to be right on the render that first shows the strip, and reading a key back out of
  // storage is an idempotent read with nothing to synchronise. Re-read per board, because a hire
  // on two projects folded each one separately.
  const [readFor, setReadFor] = useState<string | null>(null);
  if (boardId !== readFor) {
    setReadFor(boardId);
    setIsOpen(readPathWindowOpen(boardId));
  }

  useEffect(() => {
    let cancelled = false;

    void onboardingService
      .fetchPath()
      .then((path) => {
        if (!cancelled) setWhere(pathWindow(path));
      })
      // No path, or no reaching it: the board has plenty else to show, and a strip that cannot
      // say where somebody is should not say anything at all.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  if (!where || where.nodes.length === 0) return null;

  const current = where.nodes.find((node) => node.id === where.currentId);

  function fold(open: boolean) {
    setIsOpen(open);
    writePathWindowOpen(boardId, open);
  }

  return (
    <section aria-label="Where you are in your path">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs text-app-text-muted">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-expanded={isOpen}
            // Only while the panel is mounted: folded, there is nothing for it to point at.
            aria-controls={isOpen ? panelId : undefined}
            aria-label={
              isOpen ? "Hide where you are in your path" : "Show where you are in your path"
            }
            title={isOpen ? "Hide the path" : "Show the path"}
            onClick={() => fold(!isOpen)}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
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
        <span className="flex shrink-0 items-center gap-1">
          <Link
            to="/onboarding"
            className="text-xs font-medium text-app-brand-text underline-offset-2 hover:underline"
          >
            See the whole path
          </Link>
          {/*
            Beside the way *in*, because they are the two things somebody might want from a strip
            they are done reading: the whole thing, or none of it.
          */}
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Take this off your board"
            title="Take this off your board"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </span>
      </div>

      {/*
        No box around it. A border and and a panel would make this a section of the page competing
        with the eleven cards below; what it is is a few nodes drawn on the board's own surface,
        and the nodes are the thing with edges on them.
      */}
      {/*
        Tall enough for the graph to be a graph. A chain of three phases is three rows on a canvas
        that lays prerequisites out downwards, and in the twelve-rem strip this used to be, the fit
        landed under a third — three cards nobody could read the titles of, which is a worse answer
        to "where am I" than the sentence above it alone. That is also why it folds: this much room
        has to be worth taking, and some days it is not.
      */}
      <Collapsible open={isOpen}>
        <div id={panelId} className="h-[26rem]">
          <BlueprintGraphCanvas<PathWindowNode>
            nodes={where.nodes}
            title=""
            description=""
            editable={false}
            height="fill"
            ariaLabel="Where you are in your path"
            emptyTitle="Nothing to show yet"
            // A phase on the strip is the phase on the path page, so pressing one goes there and
            // lands on it. A picture of where somebody stands that cannot be stepped into makes them
            // find the same phase again by hand on the page it links to.
            onNodeClick={(node) =>
              void navigate("/onboarding", { state: { openPhaseId: node.id } })
            }
            onPositionChange={() => Promise.resolve()}
            onAddBlocker={() => Promise.resolve()}
            onRemoveBlocker={() => Promise.resolve()}
            // A finished phase's arrow is satisfied and says so; the one into where the hire actually
            // is, is the live one; everything past that is still shut. The strip is about standing
            // somewhere in a path, and an arrow that does not say which side of "here" it is on has
            // left out the only thing being asked.
            edgeTone={(node, blockerId) => {
              const blocker = where.nodes.find((candidate) => candidate.id === blockerId);
              if (blocker?.state !== "done") return "waiting";
              return node.state === "locked" ? "waiting" : "active";
            }}
            renderNode={(node, cardProps) => {
              const state = STATES[node.state];
              return (
                <BlueprintNodeCard
                  {...cardProps}
                  title={node.title}
                  kind={{ label: "Phase", icon: Layers }}
                  accent={state.accent}
                  status={{ label: state.label, variant: state.variant, icon: state.icon }}
                  highlighted={node.id === where.currentId}
                  // The ring around the glyph rather than a count on the line: how far through a
                  // phase somebody is, is the one number this strip exists to show.
                  progress={node.progress}
                />
              );
            }}
          />
        </div>
      </Collapsible>
    </section>
  );
}
