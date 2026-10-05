import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Milestone } from "lucide-react";
import { Textarea, type TextareaProps } from "../../../components/ui/Textarea";
import { useBoardPath } from "../hooks/boardPath";
import { completeLink, openLinkBefore, titleKey } from "../layout/stepLinks";

/** How many steps are offered at once; typing more of the title narrows them. */
const OFFERED = 6;

type StepLinkTextareaProps = Omit<TextareaProps, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * A note's text field that offers the path's steps as soon as `[[` is typed, like Obsidian does for
 * notes — see `layout/stepLinks.ts` for what a link is and does.
 *
 * The offer narrows as the title is typed; ↑/↓ move through it, Enter or Tab takes one, Escape puts
 * it away until the next `[[`. Without a path there is nothing to offer and it is a plain text field.
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

  const steps = useMemo(
    () =>
      [...(path?.phases ?? [])]
        .sort((left, right) => left.position - right.position)
        .flatMap((phase) =>
          (phase.steps ?? []).map((step) => ({
            id: step.id,
            title: step.title,
            phase: phase.title,
          })),
        ),
    [path],
  );

  const open = openLinkBefore(value, caret);
  const offered =
    open && open.start !== dismissedAt && steps.length > 0
      ? steps
          .filter((step) => titleKey(step.title).includes(titleKey(open.query)))
          .slice(0, OFFERED)
      : [];
  const listId = `${rest.id ?? "note"}-step-links`;

  function track() {
    const element = ref.current;
    if (element) setCaret(element.selectionStart);
  }

  function pick(title: string) {
    const done = completeLink(value, caret, title);
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
        pick(offered[Math.min(active, offered.length - 1)].title);
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
    <div className="relative">
      <Textarea
        {...rest}
        ref={ref}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setCaret(event.target.selectionStart);
          setActive(0);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={track}
        onClick={track}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={offered.length > 0}
        aria-controls={offered.length > 0 ? listId : undefined}
      />

      {offered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Steps to link"
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-app-border bg-app-surface p-1 shadow-lg"
        >
          {offered.map((step, index) => (
            <li
              key={step.id}
              role="option"
              aria-selected={index === active}
              // `mousedown`, not `click`: a click would blur the field first and lose the caret.
              onMouseDown={(event) => {
                event.preventDefault();
                pick(step.title);
              }}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm ${
                index === active ? "bg-app-brand-soft text-app-brand-text" : "text-app-text"
              }`}
            >
              <Milestone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{step.title}</span>
                <span className="block truncate text-xs text-app-text-muted">{step.phase}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {steps.length > 0 && (
        <p className="mt-1 text-xs text-app-text-subtle">
          Type <kbd className="rounded border border-app-border px-1 font-mono">[[</kbd> to link a
          step of your path.
        </p>
      )}
    </div>
  );
}
