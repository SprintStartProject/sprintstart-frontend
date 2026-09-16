import { useEffect, useState } from "react";
import { Check, CheckCircle2, X } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { parseCandidateSource, trackerLabel } from "../sourceId";
import type { StarterWorkTask } from "../types";

type StarterWorkTriageProps = {
  /** Snapshotted once on open — a task leaving or joining the live queue mid-session does not reshuffle it. */
  tasks: StarterWorkTask[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onClose: () => void;
};

/** How long the card's exit animation plays before the next one takes its place. */
const EXIT_ANIMATION_MS = 220;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Goes through the unreviewed queue one task at a time, instead of a PM having to open each one's
 * drawer in turn. "Later" just moves on — it is not a decision, and does not count toward the
 * tally the closing screen reports. "Remove" and "Looks good" call the same `approve`/`reject` the
 * drawer and the quick actions use, so a task decided here is decided everywhere.
 */
export function StarterWorkTriage({ tasks, onApprove, onReject, onClose }: StarterWorkTriageProps) {
  const [items] = useState(tasks);
  const [position, setPosition] = useState(0);
  const [decidedCount, setDecidedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exiting, setExiting] = useState<"ok" | "no" | "skip" | null>(null);

  const current = items[position];
  const isDone = !current;
  const progressPct = items.length === 0 ? 100 : Math.round((position / items.length) * 100);

  const act = async (kind: "ok" | "no" | "skip") => {
    if (busy || !current) return;
    setBusy(true);
    setExiting(kind);
    try {
      if (kind === "ok") await onApprove(current.id);
      if (kind === "no") await onReject(current.id);
      await wait(EXIT_ANIMATION_MS);
      if (kind !== "skip") setDecidedCount((count) => count + 1);
      setPosition((index) => index + 1);
    } catch {
      // The page's handler already raised a toast for the failure; stay on this card.
    } finally {
      setBusy(false);
      setExiting(null);
    }
  };

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (busy || isDone) return;
      const key = event.key.toLowerCase();
      if (key === "a" || event.key === "Enter") void act("ok");
      else if (key === "s") void act("skip");
      else if (key === "x") void act("no");
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `act` closes over fresh state each render; re-binding every render is the point.
  }, [busy, isDone, current]);

  const { trackerCode, hasKnownTracker, numberLabel, repo } = current
    ? parseCandidateSource(current.sourceId)
    : { trackerCode: "", hasKnownTracker: false, numberLabel: null, repo: null };

  return (
    <Modal
      isOpen
      title="Go through tasks nobody has looked at"
      size="lg"
      testId="starter-work-triage"
      onClose={onClose}
      bodyClassName="px-5 py-5 sm:px-7 sm:py-6"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-app-neutral-bg">
          <div
            className="h-full rounded-full bg-app-brand transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-app-text-subtle tabular-nums" data-testid="triage-count">
          {isDone ? "Done" : `${position + 1} of ${items.length}`}
        </span>
      </div>

      {isDone ? (
        <div className="py-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-app-success-bg text-app-success-text">
            <Check className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="mb-1.5 text-base font-semibold text-app-text">All caught up</h3>
          <p className="mb-6 text-sm text-app-text-muted">
            You looked at {decidedCount} {decidedCount === 1 ? "task" : "tasks"}. The ones you kept
            now rank normally for hires.
          </p>
          <Button variant="primary" onClick={onClose}>
            Back to the pool
          </Button>
        </div>
      ) : (
        <>
          <div
            data-testid="triage-card"
            className={`rounded-2xl border border-dashed border-app-brand-border bg-app-surface p-5 transition-all duration-200 ${
              exiting === "ok"
                ? "translate-x-16 rotate-2 opacity-0"
                : exiting === "no"
                  ? "-translate-x-16 -rotate-2 opacity-0"
                  : exiting === "skip"
                    ? "translate-y-6 opacity-0"
                    : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="brand" size="sm">
                {hasKnownTracker ? trackerLabel(trackerCode) : "Custom"}
              </Badge>
              {hasKnownTracker && numberLabel && (
                <Badge variant="neutral" size="sm">
                  {numberLabel}
                </Badge>
              )}
              {hasKnownTracker && repo && (
                <span className="text-xs text-app-text-subtle">{repo}</span>
              )}
            </div>
            <h3 className="mt-2 text-base font-semibold text-app-text">{current.title}</h3>
            {current.summary && (
              <p className="mt-1 text-sm text-app-text-muted">{current.summary}</p>
            )}
            {current.rationale && (
              <div className="mt-3 rounded-xl bg-app-surface-muted px-3 py-2.5 text-sm text-app-text-muted">
                <span className="font-semibold text-app-text">Why the AI picked it: </span>
                {current.rationale}
              </div>
            )}
            {current.competencyKeys.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {current.competencyKeys.map((key) => (
                  <li key={key}>
                    <Badge variant="purple" size="sm">
                      {key}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <button
              type="button"
              data-testid="triage-remove"
              disabled={busy}
              onClick={() => void act("no")}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-app-danger-border bg-app-danger-bg text-sm font-semibold text-app-danger-text transition-colors hover:border-app-danger-solid hover:bg-app-danger-solid hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Remove <kbd className="opacity-60">X</kbd>
            </button>
            <button
              type="button"
              data-testid="triage-later"
              disabled={busy}
              onClick={() => void act("skip")}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-app-border text-sm font-semibold text-app-text transition-colors hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Later <kbd className="opacity-60">S</kbd>
            </button>
            <button
              type="button"
              data-testid="triage-approve"
              disabled={busy}
              onClick={() => void act("ok")}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-app-success-border bg-app-success-bg text-sm font-semibold text-app-success-text transition-colors hover:border-app-success-solid hover:bg-app-success-solid hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Looks good <kbd className="opacity-60">A</kbd>
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
