import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ListChecks, Milestone } from "lucide-react";
import { Textarea, type TextareaProps } from "../../../components/ui/Textarea";
import { useBoardPath } from "../hooks/boardPath";
import { completeLink, openLinkBefore, titleKey } from "../layout/stepLinks";

/** How many steps and tasks are offered at once; typing more of the title narrows them. */
const OFFERED = 8;

/** One thing a `[[` can link: a step, or a task in one — see `layout/stepLinks.ts`. */
type Offer = { key: string; link: string; title: string; detail: string; task: boolean };

type StepLinkTextareaProps = Omit<TextareaProps, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * A note's text field that offers the path's steps and their tasks as soon as `[[` is typed, like
 * Obsidian does for notes — see `layout/stepLinks.ts` for what a link is and does.
 *
 * The offer narrows as the title is typed: a step's name finds the step and its tasks, a task's
 * name finds the task. ↑/↓ move through it, Enter or Tab takes one, Escape puts it away until the
 * next `[[`. Without a path there is nothing to offer and it is a plain text field.
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
  const { path } = useBoardPath();
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(value.length);
  const [active, setActive] = useState(0);
  /** Where the `[[` that Escape put away starts, so the same one does not reopen at once. */
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const offers = useMemo<Offer[]>(
    () =>
      [...(path?.phases ?? [])]
        .sort((left, right) => left.position - right.position)
        .flatMap((phase) =>
          (phase.steps ?? []).flatMap((step) => [
            { key: step.id, link: step.title, title: step.title, detail: phase.title, task: false },
            ...[...(step.tasks ?? [])]
              .sort((left, right) => left.position - right.position)
              .map((task) => ({
                key: task.id,
                link: `${step.title}#${task.title}`,
                title: task.title,
                detail: step.title,
                task: true,
              })),
          ]),
        ),
    [path],
  );

  const open = openLinkBefore(value, caret);
  const query = open ? titleKey(open.query.replace("#", " ")) : "";
  const offered =
    open && open.start !== dismissedAt
      ? offers
          .filter((offer) => titleKey(`${offer.detail} ${offer.title}`).includes(query))
          .slice(0, OFFERED)
      : [];
  const listId = `${rest.id ?? "note"}-step-links`;

  function track() {
    const element = ref.current;
    if (element) setCaret(element.selectionStart);
  }

  function pick(link: string) {
    const done = completeLink(value, caret, link);
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
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pick(offered[Math.min(active, offered.length - 1)].link);
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
      />

      {offered.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Steps and tasks to link"
          className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-app-border bg-app-surface p-1 shadow-sm"
        >
          {offered.map((offer, index) => (
            <li
              key={offer.key}
              role="option"
              aria-selected={index === active}
              // `mousedown`, not `click`: a click would blur the field first and lose the caret.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(offer.link);
              }}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${
                index === active ? "bg-app-brand-soft text-app-brand-text" : "text-app-text"
              }`}
            >
              {offer.task ? (
                <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Milestone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="min-w-0">
                <span className="block truncate font-medium">{offer.title}</span>
                <span className="block truncate text-xs text-app-text-muted">
                  {offer.task ? `Task in ${offer.detail}` : offer.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        offers.length > 0 && (
          <p className="mt-1 text-xs text-app-text-subtle">
            Type <kbd className="rounded border border-app-border px-1 font-mono">[[</kbd> to link a
            step or task of your path.
          </p>
        )
      )}
    </div>
  );
}
