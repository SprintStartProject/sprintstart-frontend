import type { ReactNode } from "react";
import { Flag, Info, LayoutGrid, Plus, Search, TriangleAlert, Waypoints } from "lucide-react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Spinner } from "../../../components/ui/Spinner.tsx";
import { CanvasButton } from "../../onboarding/graph/JourneyCanvas.tsx";
import type { ChainHalf } from "../hooks/useChainFocus.ts";

/**
 * Only where there is something to head. A canvas embedded in something that has already named it --
 * a strip on a board, a panel about one card -- was drawing an empty `h2` and an empty paragraph
 * above itself: sixty pixels of nothing in a two-hundred-pixel strip, and a heading with no text in
 * it, which is a heading a screen reader announces and cannot read.
 */
export function CanvasHeader(props: {
  title: string;
  description: string;
  headerAction?: ReactNode;
}) {
  const { title, description, headerAction } = props;
  if (!title && !headerAction) return null;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-app-border px-5 py-4">
      <div className="min-w-0">
        {title ? <h2 className="text-base font-semibold text-app-text">{title}</h2> : null}
        {description ? <p className="mt-1 text-sm text-app-text-muted">{description}</p> : null}
      </div>
      {headerAction ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{headerAction}</div>
      ) : null}
    </div>
  );
}

/**
 * The search sits on the canvas rather than in the header: what it does happens here, and a control
 * whose effect is three inches away from it reads as a page filter rather than as a way of looking at
 * this graph.
 */
export function NodeSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-app-text-subtle"
        aria-hidden="true"
      />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Find a node"
        aria-label="Find a node on the canvas"
        className="h-8 w-44 rounded-lg border border-app-border bg-app-surface/95 pr-2 pl-8 text-xs text-app-text shadow-sm backdrop-blur placeholder:text-app-text-subtle"
      />
    </div>
  );
}

/**
 * What pointing at a node actually told you, in words. The picture says which nodes are in the run;
 * this says how much of it there is -- the number nobody can count off a picture, and the one that
 * decides whether a node is worth doing early. "Opens 4" is the difference between a node in the way
 * and a node in a corner.
 */
export function RunSummary({
  title,
  behind,
  ahead,
}: {
  title: string | undefined;
  behind: number;
  ahead: number;
}) {
  return (
    <div className="max-w-56 rounded-xl border border-app-border bg-app-surface/95 px-3 py-2 shadow-md backdrop-blur">
      <p className="truncate text-xs font-semibold text-app-text">{title}</p>
      <p className="mt-1 flex flex-col gap-1 text-xs text-app-text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full bg-app-orange-text" />
          {behind === 0 ? "Nothing has to happen first" : `${behind} must happen first`}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full bg-app-brand" />
          {ahead === 0 ? "Nothing waits on this" : `Finishing it opens ${ahead}`}
        </span>
      </p>
    </div>
  );
}

/**
 * The proposal states what it did and what happens next, because "Tidy up" has already redrawn the
 * canvas by the time this is read: without the sentence, an author cannot tell an applied change from
 * an offered one.
 */
export function TidyProposal({
  onAccept,
  onDiscard,
}: {
  onAccept: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-app-brand-border bg-app-surface p-3 shadow-app-brand-lift">
      <p className="text-sm font-semibold text-app-text">Laid out by prerequisite</p>
      <p className="text-xs text-app-text-muted">
        Nothing is saved yet. Drag any card to adjust it first, or put the old arrangement back.
      </p>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={onAccept}>
          Keep this
        </Button>
        <Button variant="secondary" size="sm" onClick={onDiscard}>
          Put it back
        </Button>
      </div>
    </div>
  );
}

/**
 * An empty canvas is indistinguishable from one that failed to load, and a first-time author has no
 * way to guess what makes a node. This says both -- and it does not intercept the pointer, so a
 * double-click through it still makes one.
 */
export function EmptyNotice({ title, canMake }: { title: string; canMake: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="max-w-sm rounded-2xl border border-dashed border-app-border bg-app-surface/90 px-6 py-5 text-center">
        <Waypoints className="mx-auto h-8 w-8 text-app-text-disabled" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-app-text">{title}</p>
        <p className="mt-1 text-sm text-app-text-muted">
          {canMake
            ? "Double-click anywhere here to make one, or use the button below."
            : "Nothing has been placed here yet."}
        </p>
      </div>
    </div>
  );
}

/** That a save is on its way, or why it failed. */
export function SaveStatus({
  isSaving,
  saveError,
}: {
  isSaving: boolean;
  saveError: string | null;
}) {
  return (
    <>
      {isSaving ? (
        <p className="absolute bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg bg-app-surface px-3 py-2 text-xs text-app-text-muted shadow-lg">
          <Spinner size="sm" silent /> Saving graph…
        </p>
      ) : null}
      {saveError ? (
        <p
          role="alert"
          className="absolute bottom-4 left-4 z-40 flex max-w-sm items-start gap-1.5 rounded-lg bg-app-danger-bg px-3 py-2 text-xs text-app-danger-text shadow-lg"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {saveError}
        </p>
      ) : null}
    </>
  );
}

type ToolbarProps = {
  canAuthor: boolean;
  /** What this canvas can make, with the button that makes each. Nothing to offer when empty. */
  createKinds: { id: string; label: string }[];
  hasCreate: boolean;
  onCreate: (kindId: string) => void;
  isEmbedded: boolean;
  chainOnly: boolean;
  /** Whether a run is lit, which is what there is to narrow to. */
  hasRun: boolean;
  onToggleChainOnly: () => void;
  isLegendOpen: boolean;
  onToggleLegend: () => void;
  onTidyUp: () => void;
};

/** The canvas's own tools, after the zoom bar: make a node, narrow to a run, the legend, tidy up. */
export function CanvasToolbar(props: ToolbarProps) {
  const { canAuthor, isEmbedded, chainOnly, isLegendOpen } = props;
  return (
    <>
      {canAuthor && props.hasCreate
        ? props.createKinds.map((kind) => (
            <CanvasButton key={kind.id} label={kind.label} onClick={() => props.onCreate(kind.id)}>
              <Plus className="h-4 w-4" />
            </CanvasButton>
          ))
        : null}
      {isEmbedded ? null : (
        <CanvasButton
          label={chainOnly ? "Show the whole graph again" : "Show only the selected run"}
          active={chainOnly}
          disabled={!props.hasRun}
          onClick={props.onToggleChainOnly}
        >
          <Waypoints className="h-4 w-4" />
        </CanvasButton>
      )}
      {isEmbedded ? null : (
        <CanvasButton
          label={isLegendOpen ? "Hide the legend" : "What the symbols mean"}
          active={isLegendOpen}
          onClick={props.onToggleLegend}
        >
          <Info className="h-4 w-4" />
        </CanvasButton>
      )}
      {canAuthor ? (
        <CanvasButton label="Tidy up" onClick={props.onTidyUp}>
          <LayoutGrid className="h-4 w-4" />
        </CanvasButton>
      ) : null}
    </>
  );
}

/** What each half wears. Orange is what has to come first; the brand colour is what comes after. */
const HALF_RING: Record<ChainHalf, string> = {
  focus: "ring-2 ring-app-brand ring-offset-2 ring-offset-app-bg-soft",
  behind: "ring-2 ring-app-orange-text ring-offset-2 ring-offset-app-bg-soft",
  ahead: "ring-2 ring-app-brand/60 ring-offset-2 ring-offset-app-bg-soft",
};

type FrameProps = {
  id: string;
  /** Which half of the lit run this card is in, if it is in one. */
  half: ChainHalf | null;
  dimmed: boolean;
  selected: boolean;
  isEntry: boolean;
  onEnter: () => void;
  onLeave: () => void;
  children: ReactNode;
};

/** One node's wrapper: what lights it, what quietens it, and the mark for a place to start. */
export function NodeFrame(props: FrameProps) {
  const { half, dimmed, selected } = props;
  return (
    <div
      data-testid={`graph-node-${props.id}`}
      // Which half of the lit run this card is in, as an attribute as well as a colour: the colour is
      // the answer for a reader, and this is the one thing a test can hold on to without asserting a
      // class name.
      data-chain-half={half ?? undefined}
      onMouseEnter={props.onEnter}
      onMouseLeave={props.onLeave}
      className={`relative h-full w-full rounded-xl transition-opacity duration-200 ${
        dimmed ? "opacity-35" : "opacity-100"
      } ${half ? HALF_RING[half] : selected ? "ring-2 ring-app-brand-border-strong" : ""}`}
    >
      {props.children}

      {props.isEntry ? (
        <span className="pointer-events-none absolute -top-2.5 left-3 z-10">
          <Badge variant="brand" size="sm" className="gap-1 shadow-sm">
            <Flag className="h-3 w-3" aria-hidden="true" /> Start
          </Badge>
        </span>
      ) : null}
    </div>
  );
}
