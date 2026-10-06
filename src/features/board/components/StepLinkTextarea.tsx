import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckCircle2, Layers, ListChecks, Lock, Milestone } from "lucide-react";
import { Textarea, type TextareaProps } from "../../../components/ui/Textarea";
import { onboardingService } from "../../../services/onboardingService";
import type { PhaseState } from "../../onboarding/journey";
import { useBoardPath } from "../hooks/boardPath";
import { completeLink, deepenLink, openLinkBefore, titleKey } from "../layout/stepLinks";
import { openLinkLevel } from "../layout/pathStages";

/** How many are offered at once; typing more of the name narrows them. */
const OFFERED = 8;

/** One thing a `[[` can link at the level being typed: a phase, a step in it, or a task in that. */
type Offer = {
  key: string;
  /** What goes inside the brackets: `Phase`, `Phase#Step` or `Phase#Step#Task`. */
  link: string;
  title: string;
  detail: string;
  level: "phase" | "step" | "task";
  /** Whether Tab goes one level deeper from here. */
  deeper: boolean;
  state?: PhaseState;
};

const PHASE_STATE_LABEL: Record<PhaseState, string> = {
  done: "Done",
  active: "In progress",
  open: "Open",
  locked: "Locked",
};

type StepLinkTextareaProps = Omit<TextareaProps, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * A note's text field that offers the path one level at a time once `[[` is typed: its phases,
 * then after `[[Phase#` that phase's steps, then after `[[Phase#Step#` that step's tasks. See
 * `layout/stepLinks.ts` for what a link is and does.
 *
 * Phases first because there are few of them: the list a hire picks from is a handful each time,
 * not every step of the path at once. Every phase is offered — finished, current and locked alike,
 * each saying which it is — because a note about what is coming is as much a note as one about
 * what is done.
 *
 * Enter (or a click) takes the highlighted one and closes the link; Tab takes it and goes one
 * level deeper; ↑/↓ move; Escape puts the list away until the next `[[`. Without a path there is
 * nothing to offer and it is a plain text field.
 *
 * **Tasks are asked for when they are wanted.** The path the board reads carries each step but not
 * its tasks, so they are fetched for one step at a time, the moment a `#` follows its name.
 *
 * **In the flow, not floating.** The list sits under the field and pushes what follows down. A card
 * on the board clips whatever overflows it, and a list hovering over the card's edge was cut off.
 */
export function StepLinkTextarea({
  value,
  onValueChange,
  onKeyDown,
  ...rest
}: StepLinkTextareaProps) {
  const { phases } = useBoardPath();
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(value.length);
  const [active, setActive] = useState(0);
  /** Where the `[[` that Escape put away starts, so the same one does not reopen at once. */
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  /** Tasks fetched so far, by step id. */
  const [tasksOf, setTasksOf] = useState<Record<string, { id: string; title: string }[]>>({});

  const open = openLinkBefore(value, caret);
  const at = open ? openLinkLevel(open.query, phases) : null;
  const phaseId = at && at.level !== "phase" ? at.phaseId : undefined;
  const phase = phaseId ? phases?.phaseInfo.get(phaseId) : undefined;
  const stepId = at?.level === "task" ? at.stepId : undefined;
  const step = stepId ? phases?.steps.get(stepId) : undefined;

  // The tasks of the step named before the second `#`, once, the first time they are asked for.
  useEffect(() => {
    if (!stepId || tasksOf[stepId]) return;

    let live = true;
    void onboardingService
      .fetchTasks(stepId)
      .then((tasks) => {
        if (!live) return;
        const ordered = [...tasks]
          .sort((left, right) => left.position - right.position)
          .map((task) => ({ id: task.id, title: task.title }));
        setTasksOf((current) => ({ ...current, [stepId]: ordered }));
      })
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [stepId, tasksOf]);

  const phaseOffers = useMemo<Offer[]>(
    () =>
      [...(phases?.phaseInfo.entries() ?? [])].map(([id, info]) => ({
        key: id,
        link: info.title,
        title: info.title,
        detail: PHASE_STATE_LABEL[info.state],
        level: "phase",
        deeper: info.stepIds.length > 0,
        state: info.state,
      })),
    [phases],
  );

  let offers: Offer[] = [];
  const query = at?.query ?? "";
  if (at?.level === "phase") {
    offers = phaseOffers;
  } else if (at?.level === "step" && phase) {
    offers = phase.stepIds.flatMap((id) => {
      const candidate = phases?.steps.get(id);
      return candidate
        ? [
            {
              key: id,
              link: `${phase.title}#${candidate.title}`,
              title: candidate.title,
              detail: `Step in ${phase.title}`,
              level: "step" as const,
              deeper: true,
            },
          ]
        : [];
    });
  } else if (at?.level === "task" && phase && step && stepId) {
    offers = (tasksOf[stepId] ?? []).map((task) => ({
      key: task.id,
      link: `${phase.title}#${step.title}#${task.title}`,
      title: task.title,
      detail: `Task in ${step.title}`,
      level: "task" as const,
      deeper: false,
    }));
  }

  const offered =
    open && open.start !== dismissedAt
      ? offers
          // A title with brackets in it would close the link early; it cannot be linked by name.
          .filter((offer) => !/[[\]]/.test(offer.link))
          .filter((offer) => titleKey(offer.title).includes(titleKey(query)))
          .slice(0, OFFERED)
      : [];
  const fallbackId = useId();
  const listId = `${rest.id ?? fallbackId}-step-links`;

  function track() {
    const element = ref.current;
    if (element) setCaret(element.selectionStart);
  }

  function pick(offer: Offer, deeper: boolean) {
    const done =
      deeper && offer.deeper
        ? deepenLink(value, caret, offer.link)
        : completeLink(value, caret, offer.link);
    if (!done) return;

    onValueChange(done.text);
    setCaret(done.caret);
    setActive(0);
    // After React has written the new value, or the caret lands in the old one.
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(done.caret, done.caret);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (offered.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((current) => (current + step + offered.length) % offered.length);
        return;
      }
      const highlighted = offered[Math.min(active, offered.length - 1)];
      // Tab is only taken when it goes somewhere: otherwise it moves focus on, as it should.
      if (event.key === "Enter" || (event.key === "Tab" && highlighted.deeper && !event.shiftKey)) {
        event.preventDefault();
        pick(highlighted, event.key === "Tab");
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setDismissedAt(open.start);
        return;
      }
    }
    onKeyDown?.(event);
  }

  return (
    <div>
      <Textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setCaret(event.target.selectionStart);
          setActive(0);
          // A `[[` put away with Escape stays away only while it is there: once it is gone, the next
          // one is a new one, even if it is typed at the same place.
          if (!openLinkBefore(event.target.value, event.target.selectionStart))
            setDismissedAt(null);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={track}
        onClick={track}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={offered.length > 0}
        aria-controls={offered.length > 0 ? listId : undefined}
        aria-activedescendant={
          offered.length > 0 ? `${listId}-${Math.min(active, offered.length - 1)}` : undefined
        }
      />

      {offered.length > 0 ? (
        <div className="mt-1 rounded-xl border border-app-border bg-app-surface p-1 shadow-sm">
          <ul
            id={listId}
            role="listbox"
            aria-label="Phases, steps and tasks to link"
            className="max-h-56 overflow-y-auto"
          >
            {offered.map((offer, index) => (
              <li
                key={offer.key}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // `mousedown`, not `click`: a click would blur the field first and lose the caret.
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(offer, false);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${
                  index === active ? "bg-app-brand-soft text-app-brand-text" : "text-app-text"
                } ${offer.state === "locked" ? "opacity-70" : ""}`}
              >
                {offer.level === "task" ? (
                  <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : offer.level === "step" ? (
                  <Milestone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : offer.state === "done" ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : offer.state === "locked" ? (
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{offer.title}</span>
                  <span className="block truncate text-xs text-app-text-muted">{offer.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="px-2 pt-1 pb-0.5 text-xs text-app-text-subtle">
            Enter links it
            {offered.some((offer) => offer.deeper) && <> · Tab goes into it</>}
          </p>
        </div>
      ) : (
        phaseOffers.length > 0 && (
          <p className="mt-1 text-xs text-app-text-subtle">
            Type <kbd className="rounded border border-app-border px-1 font-mono">[[</kbd> to link a
            phase of your path, then{" "}
            <kbd className="rounded border border-app-border px-1 font-mono">#</kbd> for a step or
            task in it.
          </p>
        )
      )}
    </div>
  );
}
