import { Check, Filter, Send, Square } from "lucide-react";
import type { FormEvent, RefObject } from "react";
import { Button } from "../../../components/ui/Button";
import { useAutoResize } from "../../../components/ui/useAutoResize";
import { SOURCE_SYSTEMS, type SourceSystem } from "../types";

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
  // Grows with the draft, and — unlike the previous inline version, which only
  // ran while the user typed — shrinks back once the message is sent and
  // `value` is cleared from the outside.
  useAutoResize({ ref: textareaRef, value, minRows: 1, maxRows: 8 });

  // E7: surface a hint when the date range is inverted.
  const rangeInvalid = !!from && !!to && from > to;

  return (
    <footer className="app-page-frame shrink-0 border-t border-app-border bg-app-bg py-4">
      {showFilters && (
        <div className="mb-3">
          <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-app-border bg-app-surface-muted/70 px-4 py-3 backdrop-blur">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="filter-from"
                className="text-xs font-semibold tracking-wide text-app-text-muted uppercase"
              >
                From
              </label>

              <input
                id="filter-from"
                type="date"
                max={to || undefined}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 rounded-xl border border-app-border bg-app-bg px-3 text-sm outline-none focus:ring-2 focus:ring-app-focus/50"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="filter-to"
                className="text-xs font-semibold tracking-wide text-app-text-muted uppercase"
              >
                To
              </label>

              <input
                id="filter-to"
                type="date"
                min={from || undefined}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 rounded-xl border border-app-border bg-app-bg px-3 text-sm outline-none focus:ring-2 focus:ring-app-focus/50"
              />
            </div>

            <div className="hidden h-8 w-px self-center bg-app-border-muted lg:block" />

            <div className="flex min-w-[240px] flex-1 flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-app-text-muted uppercase">
                  Systems
                </span>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear All
                  </Button>
                )}
              </div>

              <div
                role="group"
                aria-label="Source systems"
                className="flex min-h-10 flex-wrap items-center gap-2"
              >
                {SOURCE_SYSTEMS.map((source) => {
                  const selected = sourceSystems.includes(source);

                  return (
                    <button
                      key={source}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleSourceSystem(source)}
                      className={`flex h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold tracking-wide uppercase transition-colors ${
                        selected
                          ? "border-app-brand bg-app-brand text-white"
                          : "border-app-border bg-app-bg text-app-text hover:bg-app-surface"
                      }`}
                    >
                      {selected && <Check size={13} />}
                      {source}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {rangeInvalid && (
            <p className="mt-1 text-xs text-app-danger-text" role="alert">
              The &ldquo;From&rdquo; date can&apos;t be after the &ldquo;To&rdquo; date.
            </p>
          )}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 rounded-2xl border border-app-border-muted bg-app-surface-muted p-2 transition focus-within:border-app-brand-border focus-within:ring-2 focus-within:ring-app-focus/40"
      >
        <Button
          variant="secondary"
          size="sm"
          iconOnly
          aria-label="Toggle source filters"
          aria-expanded={showFilters}
          data-testid="chat-filters-toggle"
          onClick={onToggleFilters}
          className="relative shrink-0"
        >
          <Filter size={18} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-app-brand text-[10px] font-bold text-white shadow-sm ring-1 ring-app-surface">
              {activeFilterCount}
            </span>
          )}
        </Button>
        {/* Not a `Textarea`: this one is borderless and lives inside the
                    composer's own box, so it needs the growing behaviour without
                    the field styling. It shares the behaviour via the hook. */}
        <textarea
          ref={textareaRef}
          aria-label="Message"
          data-testid="chat-input"
          placeholder="Ask anything about the project..."
          className="flex-1 resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-sm text-app-text outline-none placeholder:text-app-text-disabled"
          value={value}
          rows={1}
          onChange={(e) => onChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />

        {isBusy ? (
          <Button
            variant="danger"
            size="sm"
            iconOnly
            aria-label="Stop generation"
            data-testid="chat-stop-button"
            onClick={onStop}
            className="shrink-0"
          >
            <Square size={16} className="fill-current" />
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            iconOnly
            type="submit"
            aria-label="Send message"
            data-testid="chat-send-button"
            disabled={!value.trim()}
            className="shrink-0"
          >
            <Send size={18} />
          </Button>
        )}
      </form>

      <p className="mt-2 text-center text-[11px] text-app-text-disabled">
        Enter to send · Shift + Enter for a new line
      </p>
    </footer>
  );
}
