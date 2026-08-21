import { Check, Filter, Send, Square, X } from "lucide-react";
import { useState } from "react";
import type { FormEvent, RefObject } from "react";
import { SOURCE_META } from "../../data-ingestion/data";
import type { SourceSystem } from "../types";

type ChatComposerProps = {
  /** Current draft text. */
  value: string;
  /** Called on every keystroke; the parent owns the draft state. */
  onChange: (value: string) => void;
  /** Submit handler (form onSubmit). */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  /** Stop the in-flight stream. */
  onStop: () => void;
  /** True while the assistant is thinking or streaming. */
  isBusy: boolean;
  /**
   * Whether a project is selected. Without one there is nothing to scope retrieval to, so
   * sending is blocked here rather than failing silently after the fact.
   */
  hasProject: boolean;
  /**
   * Every question asked in this chat, oldest first. Arrow-up walks back through it and
   * arrow-down forward again, the way a shell walks its command history.
   */
  promptHistory: string[];
  /**
   * The source systems that can actually be filtered on. Offering the full hardcoded set
   * meant a connector that was never configured was still selectable, and the prompt then
   * failed instead of returning fewer results.
   */
  availableSources: SourceSystem[];
  /** True while the connector list is still being fetched. */
  sourcesLoading: boolean;

  /** Ref to the textarea, so the parent can focus / autosize it. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;

  // Filters
  showFilters: boolean;
  onToggleFilters: () => void;
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
  sourceSystems: SourceSystem[];
  toggleSourceSystem: (source: SourceSystem) => void;
  activeFilterCount: number;
  clearFilters: () => void;
};

/**
 * Composer footer: source-system + date filters (collapsible) and the
 * textarea + send/stop button. Extracted from `ChatPage` so the message
 * list and the composer can re-render independently.
 */
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  isBusy,
  hasProject,
  promptHistory,
  availableSources,
  sourcesLoading,
  textareaRef,
  showFilters,
  onToggleFilters,
  from,
  setFrom,
  to,
  setTo,
  sourceSystems,
  toggleSourceSystem,
  activeFilterCount,
  clearFilters,
}: ChatComposerProps) {
  // E7: surface a hint when the date range is inverted.
  const rangeInvalid = !!from && !!to && from > to;

  /*
    Where the arrow keys currently sit in `promptHistory`.

    Only half the answer, though: whether the composer is *still* on that entry is derived
    below from its own contents rather than tracked. Typing over a recalled prompt, sending it,
    or switching to a chat with a different history all end the walk on their own that way —
    each of which would otherwise need its own reset, and a missed one would leave arrow-up
    stepping from a stale position.
  */
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const browsingIndex =
    historyIndex !== null && promptHistory[historyIndex] === value ? historyIndex : null;

  /** Puts `text` in the composer, resized, with the caret behind it. */
  const applyRecalled = (element: HTMLTextAreaElement, text: string) => {
    onChange(text);
    element.style.height = "auto";

    requestAnimationFrame(() => {
      element.style.height = `${element.scrollHeight}px`;
      element.setSelectionRange(element.value.length, element.value.length);
    });
  };

  const recall = (element: HTMLTextAreaElement, index: number) => {
    setHistoryIndex(index);
    applyRecalled(element, promptHistory[index]);
  };
  const blocked = rangeInvalid || !hasProject;

  return (
    <footer className="app-page-frame shrink-0 border-t border-app-border bg-app-bg py-4">
      {showFilters && (
        <div className="mb-3 overflow-hidden rounded-2xl border border-app-border bg-app-surface">
          <div className="flex items-center justify-between gap-3 border-b border-app-border-muted px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-app-text-muted" />
              <span className="text-sm font-semibold text-app-text">Narrow the sources</span>
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
              >
                <X size={12} />
                Reset
              </button>
            )}
          </div>

          <div className="flex flex-col gap-5 px-4 py-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-xs font-semibold tracking-wide text-app-text-muted uppercase">
                Sources
              </legend>

              {availableSources.length === 0 ? (
                <p className="text-sm text-app-text-muted">
                  {sourcesLoading
                    ? "Loading connected sources…"
                    : "No sources are connected yet, so there is nothing to narrow down."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableSources.map((source) => {
                    const selected = sourceSystems.includes(source);
                    const meta = SOURCE_META[source];
                    const Icon = meta.icon;

                    return (
                      <button
                        key={source}
                        type="button"
                        aria-pressed={selected}
                        title={meta.description}
                        onClick={() => toggleSourceSystem(source)}
                        className={`group flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                          selected
                            ? "border-app-brand-border bg-app-brand/10 text-app-brand-text"
                            : "border-app-border bg-app-bg text-app-text-muted hover:border-app-border-strong hover:text-app-text"
                        }`}
                      >
                        <span
                          className={`flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                            selected
                              ? "border-app-brand bg-app-brand text-white"
                              : "border-app-border-strong bg-transparent"
                          }`}
                        >
                          {selected && <Check size={11} strokeWidth={3} />}
                        </span>
                        <Icon size={15} className="shrink-0 opacity-70" />
                        {meta.type}
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-app-text-subtle">
                {sourceSystems.length === 0
                  ? "Nothing selected — every connected source is searched."
                  : "Only the selected sources are searched."}
              </p>
            </fieldset>

            <div className="h-px bg-app-border-muted" />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-xs font-semibold tracking-wide text-app-text-muted uppercase">
                Indexed between
              </legend>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="filter-from"
                  type="date"
                  aria-label="Earliest date"
                  max={to || undefined}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className={`h-10 rounded-xl border bg-app-bg px-3 text-sm text-app-text transition-colors outline-none focus-visible:ring-2 focus-visible:ring-app-focus/50 ${
                    rangeInvalid ? "border-app-danger-border" : "border-app-border"
                  }`}
                />

                <span className="text-sm text-app-text-subtle">to</span>

                <input
                  id="filter-to"
                  type="date"
                  aria-label="Latest date"
                  min={from || undefined}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={`h-10 rounded-xl border bg-app-bg px-3 text-sm text-app-text transition-colors outline-none focus-visible:ring-2 focus-visible:ring-app-focus/50 ${
                    rangeInvalid ? "border-app-danger-border" : "border-app-border"
                  }`}
                />

                {(from || to) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFrom("");
                      setTo("");
                    }}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
                  >
                    Clear dates
                  </button>
                )}
              </div>

              {rangeInvalid ? (
                <p className="text-xs text-app-danger-text" role="alert">
                  The first date is after the second one, so nothing would match.
                </p>
              ) : (
                <p className="text-xs text-app-text-subtle">
                  Leave empty to search regardless of when a document was indexed.
                </p>
              )}
            </fieldset>
          </div>
        </div>
      )}

      <form
        // The hint below is not enough on its own: Enter submits the
        // form directly, so an inverted range would still reach the
        // backend and come back as a validation error.
        onSubmit={(e) => {
          if (blocked) {
            e.preventDefault();
            return;
          }
          onSubmit(e);
        }}
        className="flex items-end gap-2 rounded-2xl border border-app-border-muted bg-app-surface-muted p-2 transition focus-within:border-app-brand-border focus-within:ring-2 focus-within:ring-app-focus/40"
      >
        <button
          type="button"
          aria-label="Toggle source filters"
          aria-expanded={showFilters}
          data-testid="chat-filters-toggle"
          onClick={onToggleFilters}
          className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-app-border-muted bg-app-surface text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
        >
          <Filter size={18} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-app-brand text-[10px] font-bold text-white shadow-sm ring-1 ring-app-surface">
              {activeFilterCount}
            </span>
          )}
        </button>
        <textarea
          ref={textareaRef}
          aria-label="Message"
          data-testid="chat-input"
          placeholder={
            hasProject
              ? "Ask anything about the project..."
              : "Select a project to start asking questions"
          }
          className="max-h-44 min-h-9 flex-1 resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-sm text-app-text outline-none placeholder:text-app-text-disabled"
          value={value}
          rows={1}
          onChange={(e) => {
            onChange(e.currentTarget.value);
            e.currentTarget.style.height = "auto";
            e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
              return;
            }

            if (e.key === "ArrowUp") {
              // From a composer the user has written in, arrow-up has to keep moving the
              // caret or editing a multi-line draft becomes impossible. Mid-walk it keeps
              // walking, which is the only way to reach anything but the newest entry.
              if (browsingIndex === null && value) return;
              if (promptHistory.length === 0) return;

              e.preventDefault();

              if (browsingIndex === null) {
                recall(e.currentTarget, promptHistory.length - 1);
                return;
              }

              // Already at the oldest: stay there rather than wrapping around, so holding
              // the key does not silently cycle back to the newest.
              recall(e.currentTarget, Math.max(browsingIndex - 1, 0));
              return;
            }

            if (e.key === "ArrowDown") {
              // Only meaningful mid-walk; otherwise the caret moves as usual.
              if (browsingIndex === null) return;

              e.preventDefault();

              const next = browsingIndex + 1;

              if (next >= promptHistory.length) {
                // Past the newest is a blank composer again, to write something of your own.
                // Nothing to restore: a walk can only start from an empty composer, because
                // arrow-up with text in it has to go on moving the caret.
                setHistoryIndex(null);
                applyRecalled(e.currentTarget, "");
                return;
              }

              recall(e.currentTarget, next);
            }
          }}
        />

        {isBusy ? (
          <button
            type="button"
            aria-label="Stop generation"
            data-testid="chat-stop-button"
            onClick={onStop}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-app-danger-border bg-app-danger-solid text-white transition-colors hover:opacity-90"
          >
            <Square size={16} className="fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Send message"
            data-testid="chat-send-button"
            disabled={!value.trim() || blocked}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-app-brand text-white transition-colors hover:bg-app-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        )}
      </form>

      {!hasProject && (
        <p className="mt-2 text-center text-[11px] text-app-danger-text" role="alert">
          No project selected — pick one in the header to ask a question.
        </p>
      )}

      <p className="mt-2 text-center text-[11px] text-app-text-disabled">
        Enter to send · Shift + Enter for a new line
      </p>
    </footer>
  );
}
