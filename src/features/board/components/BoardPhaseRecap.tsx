import { useState } from "react";
import { MessageCircle, PartyPopper, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useFocusMode } from "../../../context/useFocusMode";
import { openAiBuddy } from "../../buddy/aiBuddyBus";
import { isPhaseOpen } from "../../onboarding/activePhase";
import type { OnboardingPathEndpoint } from "../../onboarding/types";
import { readOfferedRecaps, writeOfferedRecaps } from "../layout/phaseRecaps";

type BoardPhaseRecapProps = {
  boardId: string;
  path: OnboardingPathEndpoint | null;
};

/** Whether a title can sit inside `[[…]]`: brackets in it would close the link early. */
function linkable(title: string): boolean {
  return !/[[\]]/.test(title);
}

/**
 * "You finished Setup — want a recap to keep?"
 *
 * When a phase is done, what it taught is spread over a dozen steps the hire will not open again.
 * This offers to have the buddy write it down once, in the dock, where the hire can read it and keep
 * it with the dock's own button. The buddy is asked to open the recap with a `[[Phase]]` link, so the
 * kept note files under *Behind you* with the rest of that phase like any other linked note.
 *
 * **Once per phase, and only the latest.** Offered for the most recently finished phase, never for
 * a backlog of them, and gone for good as soon as it is answered or waved away. Not in focus mode:
 * the dock it opens is put away there.
 */
export function BoardPhaseRecap({ boardId, path }: BoardPhaseRecapProps) {
  const { isFocused } = useFocusMode();
  const [offered, setOffered] = useState<Set<string>>(new Set());
  const [readFor, setReadFor] = useState<string | null>(null);

  if (boardId !== readFor) {
    setReadFor(boardId);
    setOffered(readOfferedRecaps(boardId));
  }

  if (!path || isFocused) return null;

  const latest = [...path.phases]
    .sort((left, right) => left.position - right.position)
    .filter(
      (phase) =>
        (phase.steps ?? []).length + (phase.questions ?? []).length > 0 && !isPhaseOpen(phase),
    )
    .at(-1);

  if (!latest || offered.has(latest.id)) return null;

  function settle() {
    if (!latest) return;
    const next = new Set(offered).add(latest.id);
    setOffered(next);
    writeOfferedRecaps(boardId, next);
  }

  function ask() {
    if (!latest) return;
    openAiBuddy({
      draft: `I just finished the phase “${latest.title}”. Give me a short recap I can keep: what it covered, the few things I should remember, and anything on my board from it.${linkable(latest.title) ? ` Start it with [[${latest.title}]] so the recap links back to the phase.` : ""}`,
    });
    settle();
  }

  return (
    <section
      aria-label={`Recap of ${latest.title}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-app-border bg-app-surface px-4 py-3"
    >
      <PartyPopper className="h-4 w-4 shrink-0 text-app-brand-text" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-app-text-muted">
        You finished <span className="font-medium text-app-text">{latest.title}</span>. Want a recap
        to keep?
      </p>
      <Button
        variant="secondary"
        size="sm"
        onClick={ask}
        icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
      >
        Ask your buddy
      </Button>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        onClick={settle}
        title="Not now"
        aria-label="Not now"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </section>
  );
}
