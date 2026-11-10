import type { ReactNode, RefCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useDialogFocus } from "../../../components/ui/useDialogFocus.ts";

/** Where one step forward or back from an opened node goes, and what that step is. */
export type NodeStep = { node: { id: string; title: string }; relation: string };

/**
 * One step either side of the opened node.
 *
 * Carries the title, not only a chevron: two chevrons say "there is more this way", which is the
 * one thing somebody already knew. The relation in front of it says whether this is the blueprint's
 * own order or merely the author's list order, so a step never quietly claims to be a prerequisite.
 *
 * A side with nowhere to go is drawn disabled rather than removed, because the pair is also how
 * somebody learns the swipe exists, and a control that comes and goes is one nobody trusts.
 */
function StepButton({
  step,
  side,
  onGo,
}: {
  step: NodeStep | null;
  side: "previous" | "next";
  onGo: (side: "previous" | "next") => void;
}) {
  const Chevron = side === "previous" ? ChevronLeft : ChevronRight;
  const label = step
    ? `${step.relation}: ${step.node.title}`
    : side === "previous"
      ? "Nothing before this one"
      : "Nothing after this one";

  return (
    <button
      type="button"
      disabled={!step}
      onClick={() => onGo(side)}
      aria-label={label}
      title={`${label} (or swipe sideways)`}
      className={`flex max-w-40 items-center gap-1 rounded-xl border border-app-border/70 px-2 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        step
          ? "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
          : "text-app-text-subtle"
      } ${side === "next" ? "flex-row-reverse" : ""}`}
    >
      <Chevron className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="hidden min-w-0 truncate sm:inline">{step?.node.title ?? "—"}</span>
    </button>
  );
}

type HeaderProps = {
  title: string;
  context?: string;
  previous: NodeStep | null;
  next: NodeStep | null;
  onBack: () => void;
  onGo: (side: "previous" | "next") => void;
};

/** The way back out along the top, the node's own title, and the steps either side of it. */
function CoverHeader({ title, context, previous, next, onBack, onGo }: HeaderProps) {
  return (
    <header className="border-b border-app-border bg-app-brand-soft/30 px-4 py-3 sm:px-6">
      <nav
        aria-label="Where you are"
        className="flex min-w-0 items-center gap-1 text-xs text-app-text-muted"
      >
        <button
          type="button"
          onClick={onBack}
          title="Back to the graph (Esc, or click beside this)"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-app-surface-hover hover:text-app-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {context ? `Back to ${context}` : "Back to the graph"}
        </button>
      </nav>
      {/*
        No shrink-back button in the corner. There were three ways out of this page and one of
        them was a glyph somebody had to find and aim at, next to a link that already said
        where it went in words.
      */}
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-lg leading-snug font-bold text-app-text sm:text-xl">
          {title}
        </h3>
        {/*
          In the header rather than as arrows floating beside the page. The page is as wide as
          the canvas allows, so on most screens there is no room beside it to float anything —
          and an arrow out there could say only "that way", where these say where they go.
        */}
        {previous || next ? (
          <nav
            aria-label="Steps either side of this one"
            className="flex shrink-0 items-center gap-1"
          >
            <StepButton step={previous} side="previous" onGo={onGo} />
            <StepButton step={next} side="next" onGo={onGo} />
          </nav>
        ) : null}
      </div>
    </header>
  );
}

/**
 * A node zoomed into until it is a page, with the way back out along the top.
 *
 * The same move the journey makes when a hire opens a step, and for the same reason: a graph is
 * where this work happens, so the thing being edited should open *inside* it rather than beside
 * it. A side panel put a form next to a picture of the very thing the form was about, and spent
 * two thirds of a screen on the picture nobody was reading while they typed.
 *
 * The camera is already inside the node by the time this is drawn, so what is behind the blur is
 * the node itself — which is what makes closing it read as stepping back out rather than as a
 * sheet sliding away.
 */
type CoverProps = HeaderProps & {
  footer?: ReactNode;
  /** Takes the swipe gesture, so the whole page is what a two-finger flick lands on. */
  surfaceRef?: RefCallback<HTMLDivElement>;
  children: ReactNode;
};

export function NodeCover({ footer, surfaceRef, children, ...header }: CoverProps) {
  // A node opened until it is a page is a dialog, whatever it is drawn on: focus moves into it,
  // Tab stays inside, and focus goes back to the node when it closes. Without that, Enter on a
  // node left focus on the node this page now covers.
  const pageRef = useDialogFocus<HTMLElement>(true);

  return (
    /*
      Pressing beside the page closes it. Dismissing a layer that way is the one gesture nobody has
      to be taught, and what is behind this one is the graph the page was opened from. Escape does
      the same thing from the keyboard and the header carries the way back in words, so this is a
      shortcut rather than the only way out.
    */
    <div
      ref={surfaceRef}
      className="absolute inset-0 flex items-stretch justify-center bg-app-bg-soft/70 p-3 backdrop-blur-sm sm:p-6"
      onPointerDown={(event) => {
        // Only the backdrop itself. A pointer that went down inside the page and came up out here
        // is the end of a text selection, not somebody aiming at the graph.
        if (event.target === event.currentTarget) header.onBack();
      }}
    >
      <motion.section
        ref={pageRef}
        role="dialog"
        aria-modal="true"
        aria-label={header.title}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-app-brand-border bg-app-surface shadow-2xl outline-hidden"
      >
        <CoverHeader {...header} />

        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-app-border bg-app-surface-muted px-4 py-3 sm:px-6">
            {footer}
          </div>
        ) : null}
      </motion.section>
    </div>
  );
}
