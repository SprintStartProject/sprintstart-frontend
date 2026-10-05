import { createElement, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, NotebookPen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Textarea } from "../../../components/ui/Textarea";
import { useToast } from "../../../context/useToast";
import { boardService } from "../../../services/boardService";
import { queryKeys } from "../../../services/queryKeys";
import { onboardingPlaceUrl } from "../../onboarding/onboardingPlace";
import { useProjectContext } from "../../projects/useProjectContext";
import { loadBoard } from "../hooks/useBoard";
import { useInvalidateBoard } from "../hooks/useInvalidateBoard";
import { readCardOrigins, rememberOrigin } from "../layout/cardOrigins";
import { cardIcon } from "../layout/cardIcons";
import { cardName } from "../layout/cardNames";
import { isCardAt } from "../layout/pathStages";
import type { BoardCard } from "../types";

/** How much of a note is shown on its row before the board is the place to read the rest. */
const PREVIEW_CHARS = 140;

type StepNotesProps = {
  stepId: string;
  stepTitle: string;
};

/**
 * "Your notes" beside a step, under its resources: what the hire kept about it, and a box to write
 * the next one.
 *
 * **Folded until asked for.** Most steps never need a note, and an open text box on every one of
 * them reads as homework. Folded, it is one line saying how many there are — enough to notice that
 * you wrote something here last week, and one click from writing the next.
 *
 * The step already says what to do. What it cannot say is what happened when *this* hire did it —
 * the command that finally worked, the person who knew, the thing that was confusing. That is what
 * the board is good for, and it was the hardest thing to put there: the only ways in were copying a
 * sentence of the step itself (the same text twice) or going to the board and typing a note that
 * knew nothing about the step. So the note is written here, beside the step it is about, and filed
 * on the board with the way back to the step attached.
 *
 * What was kept from the step any other way — a reply kept from the buddy while the step was open, a
 * sentence highlighted in it — is listed here too, so the step shows everything the hire has on it
 * without them having to go and look.
 */
export function StepNotes({ stepId, stepTitle }: StepNotesProps) {
  const { selectedProjectId } = useProjectContext();
  const toast = useToast();
  const invalidateBoard = useInvalidateBoard(selectedProjectId);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  // The same query the board reads, so this list and the board cannot disagree — and a note kept
  // here, which invalidates it, shows up in the list straight away.
  const { data: board } = useQuery({
    queryKey: queryKeys.board.byProject(selectedProjectId),
    queryFn: () => loadBoard(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  if (!selectedProjectId) return null;

  const origins = readCardOrigins(selectedProjectId);
  const kept = (board?.cards ?? []).filter(
    (card) =>
      card.content.kind !== "PATH_STEP" &&
      isCardAt(card, { kind: "step", id: stepId }, null, origins),
  );

  async function keep() {
    const text = draft.trim();
    if (!text || !selectedProjectId) return;

    setSaving(true);
    try {
      const card = await boardService.addCard(selectedProjectId, { kind: "NOTE", text });
      rememberOrigin(selectedProjectId, card.id, {
        url: onboardingPlaceUrl({ kind: "step", id: stepId }),
        label: stepTitle,
      });
      invalidateBoard();
      setDraft("");
      toast.success("Kept on your board");
    } catch {
      toast.error("That note couldn't be kept", { description: "Nothing changed — try again." });
    } finally {
      setSaving(false);
    }
  }

  const panelId = `step-notes-${stepId}`;

  return (
    <section
      aria-label={`Your notes on ${stepTitle}`}
      className="rounded-xl border border-app-border"
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-1.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-app-text transition-colors hover:bg-app-surface-muted focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <NotebookPen className="h-3.5 w-3.5 shrink-0 text-app-brand" aria-hidden="true" />
        Your notes{" "}
        <span className="font-normal text-app-text-muted tabular-nums">
          {kept.length > 0 ? `· ${kept.length}` : "· add one"}
        </span>
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-app-text-subtle transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id={panelId} className="space-y-2 border-t border-app-border px-3 py-2">
          {kept.length > 0 && (
            <ul className="space-y-1.5">
              {kept.map((card) => (
                <KeptRow key={card.id} card={card} />
              ))}
            </ul>
          )}

          <label htmlFor={`step-note-${stepId}`} className="sr-only">
            A note for yourself about {stepTitle}
          </label>
          <Textarea
            id={`step-note-${stepId}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // ⌘/Ctrl+Enter keeps it, the way the buddy's composer sends.
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void keep();
              }
            }}
            minRows={2}
            placeholder="What the step doesn't say: what you tried, who helped…"
          />
          <div className="flex items-center justify-between gap-2">
            {kept.length > 0 ? (
              <Link
                to={`/board?step=${encodeURIComponent(stepId)}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
              >
                On your board
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            ) : (
              <span className="text-[11px] text-app-text-subtle">Only you see these.</span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void keep()}
              disabled={draft.trim().length === 0}
              loading={saving}
            >
              Keep
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** One kept card: its glyph, its name, and for a note the start of what it says. */
function KeptRow({ card }: { card: BoardCard }) {
  const name = cardName(card);
  const rest =
    card.content.kind === "NOTE"
      ? card.content.text.split("\n").slice(1).join(" ").replace(/==/g, "").trim()
      : "";

  return (
    <li className="flex items-start gap-2 text-xs">
      {/* `createElement` rather than a capitalised local: the glyph is looked up per card, and a
          component created during render is a new component every time. */}
      {createElement(cardIcon(card.content.kind), {
        className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-app-text-muted",
        "aria-hidden": true,
      })}
      <span className="min-w-0">
        <span className="font-medium text-app-text">{name}</span>
        {rest && (
          <span className="text-app-text-muted">
            {" "}
            — {rest.length > PREVIEW_CHARS ? `${rest.slice(0, PREVIEW_CHARS - 1)}…` : rest}
          </span>
        )}
      </span>
    </li>
  );
}
