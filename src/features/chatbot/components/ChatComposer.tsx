import { Calendar, Check, Filter, RotateCcw, Send, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SOURCE_META } from "../../data-ingestion/data";
import type { SourceSystem } from "../types";
import { centralSpringToken } from "../../../styles/tokens";

function formatDateFilterLabel(from: string, to: string): string {
  if (from && to) return `${from} → ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return "";
}

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

  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close floating popover on Escape or click outside
  useEffect(() => {
    if (!showFilters) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(target)
      ) {
        onToggleFilters();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onToggleFilters();
        filterButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showFilters, onToggleFilters]);

  const setPastDays = (days: number) => {
    const now = new Date();
    const past = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    setFrom(past.toISOString().split("T")[0]);
    setTo(now.toISOString().split("T")[0]);
  };

  const diffDays =
    from && to
      ? Math.round(
          (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : null;

  const isAllTime = !from && !to;
  const isPast7Days = diffDays === 7;
  const isPast30Days = diffDays === 30;

  return (
    <footer className="app-page-frame shrink-0 border-t border-app-border bg-app-bg py-4">
      {/* Active filter chips strip — visible whenever filters are active */}
      <AnimatePresence>
        {activeFilterCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: 4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: 4 }}
            transition={centralSpringToken}
            className="mb-2.5 flex flex-wrap items-center gap-1.5 overflow-hidden px-1"
          >
            <span className="mr-0.5 flex items-center gap-1 text-[11px] font-semibold tracking-wider text-app-text-muted uppercase">
              <Filter size={11} className="text-app-brand" />
              <span>Filtering:</span>
            </span>

            {sourceSystems.map((source) => {
              const meta = SOURCE_META[source] ?? {
                type: source,
                description: source,
                icon: Filter,
              };
              const Icon = meta.icon;
              return (
                <button
                  key={source}
                  type="button"
                  onClick={() => toggleSourceSystem(source)}
                  title={`Remove ${meta.type} filter`}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-app-brand-border bg-app-brand/10 px-2.5 py-0.5 text-xs font-medium text-app-brand-text transition-colors hover:border-app-danger-border hover:bg-app-danger-bg hover:text-app-danger-text"
                >
                  <Icon size={12} className="shrink-0 opacity-80 group-hover:opacity-100" />
                  <span>{meta.type}</span>
                  <X size={11} className="shrink-0 opacity-60 group-hover:opacity-100" />
                </button>
              );
            })}

            {(from || to) && (
              <button
                type="button"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
                title="Clear date filter"
                className="group inline-flex items-center gap-1.5 rounded-full border border-app-brand-border bg-app-brand/10 px-2.5 py-0.5 text-xs font-medium text-app-brand-text transition-colors hover:border-app-danger-border hover:bg-app-danger-bg hover:text-app-danger-text"
              >
                <Calendar size={12} className="shrink-0 opacity-80 group-hover:opacity-100" />
                <span>{formatDateFilterLabel(from, to)}</span>
                <X size={11} className="shrink-0 opacity-60 group-hover:opacity-100" />
              </button>
            )}

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-app-text-subtle transition-colors hover:bg-app-surface-hover hover:text-app-text"
            >
              <RotateCcw size={11} />
              <span>Clear all</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
        <div className="relative">
          <button
            ref={filterButtonRef}
            type="button"
            aria-label="Toggle source filters"
            aria-expanded={showFilters}
            data-testid="chat-filters-toggle"
            onClick={onToggleFilters}
            className={`relative flex size-9 shrink-0 items-center justify-center rounded-xl border transition-all ${
              showFilters || activeFilterCount > 0
                ? "border-app-brand-border-strong bg-app-brand/10 text-app-brand-text shadow-xs"
                : "border-app-border-muted bg-app-surface text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
            }`}
          >
            <Filter size={18} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-app-brand text-[10px] font-bold text-white shadow-sm ring-1 ring-app-surface">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Floating Glass Popover */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={centralSpringToken}
                onKeyDown={(e) => {
                  // Prevent Enter key in filter popover from submitting the chat message form
                  if (e.key === "Enter") e.stopPropagation();
                }}
                className="absolute bottom-full left-0 z-30 mb-3 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-app-border/80 bg-app-surface/95 p-4 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:w-[380px]"
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between border-b border-app-border-muted/70 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-lg bg-app-brand/10 text-app-brand">
                      <Filter size={13} />
                    </div>
                    <h3 className="text-xs font-semibold text-app-text">
                      Filter Knowledge Sources
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
                      >
                        <RotateCcw size={11} />
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onToggleFilters}
                      aria-label="Close filters"
                      className="flex size-6 items-center justify-center rounded-md text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {/* Sources Selection */}
                <div className="space-y-2 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wider text-app-text-muted uppercase">
                      Sources
                    </span>
                    <span className="text-[11px] text-app-text-subtle">
                      {sourceSystems.length === 0
                        ? "Searching all sources"
                        : `${sourceSystems.length} selected`}
                    </span>
                  </div>

                  {availableSources.length === 0 ? (
                    <p className="py-2 text-xs text-app-text-muted">
                      {sourcesLoading
                        ? "Loading connected sources…"
                        : "No sources are connected yet, so there is nothing to narrow down."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {availableSources.map((source) => {
                        const selected = sourceSystems.includes(source);
                        const meta = SOURCE_META[source] ?? {
                          type: source,
                          description: source,
                          icon: Filter,
                        };
                        const Icon = meta.icon;

                        return (
                          <button
                            key={source}
                            type="button"
                            aria-pressed={selected}
                            title={meta.description}
                            onClick={() => toggleSourceSystem(source)}
                            className={`group flex items-center justify-between rounded-xl border px-2.5 py-2 text-xs font-medium transition-all ${
                              selected
                                ? "border-app-brand-border-strong bg-app-brand/10 text-app-brand-text shadow-xs"
                                : "border-app-border bg-app-surface text-app-text-muted hover:border-app-border-strong hover:bg-app-surface-hover hover:text-app-text"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Icon
                                size={14}
                                className={`shrink-0 ${
                                  selected
                                    ? "text-app-brand"
                                    : "text-app-text-muted group-hover:text-app-text"
                                }`}
                              />
                              <span className="truncate">{meta.type}</span>
                            </div>
                            <span
                              className={`flex size-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                                selected
                                  ? "bg-app-brand text-white"
                                  : "border border-app-border-strong bg-transparent opacity-0 group-hover:opacity-60"
                              }`}
                            >
                              {selected && <Check size={10} strokeWidth={3} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Timeframe Selection */}
                <div className="my-3 h-px bg-app-border-muted/60" />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wider text-app-text-muted uppercase">
                      Indexed Date
                    </span>
                    {(from || to) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFrom("");
                          setTo("");
                        }}
                        className="text-[11px] font-medium text-app-brand-text hover:underline"
                      >
                        Clear dates
                      </button>
                    )}
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFrom("");
                        setTo("");
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        isAllTime
                          ? "bg-app-brand font-semibold text-white shadow-xs"
                          : "border border-app-border bg-app-surface text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                      }`}
                    >
                      All time
                    </button>
                    <button
                      type="button"
                      onClick={() => setPastDays(7)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        isPast7Days
                          ? "bg-app-brand font-semibold text-white shadow-xs"
                          : "border border-app-border bg-app-surface text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                      }`}
                    >
                      Past 7 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setPastDays(30)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        isPast30Days
                          ? "bg-app-brand font-semibold text-white shadow-xs"
                          : "border border-app-border bg-app-surface text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                      }`}
                    >
                      Past 30 days
                    </button>
                  </div>

                  {/* Custom Inputs */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-2 py-1.5 transition-colors focus-within:border-app-brand-border-strong focus-within:ring-1 focus-within:ring-app-focus">
                      <span className="text-[10px] font-semibold tracking-wide text-app-text-disabled uppercase">
                        From
                      </span>
                      <input
                        id="filter-from"
                        type="date"
                        aria-label="Earliest date"
                        max={to || undefined}
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="w-full min-w-0 bg-transparent text-xs text-app-text outline-none"
                      />
                    </div>

                    <span className="text-xs text-app-text-disabled">→</span>

                    <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-2 py-1.5 transition-colors focus-within:border-app-brand-border-strong focus-within:ring-1 focus-within:ring-app-focus">
                      <span className="text-[10px] font-semibold tracking-wide text-app-text-disabled uppercase">
                        To
                      </span>
                      <input
                        id="filter-to"
                        type="date"
                        aria-label="Latest date"
                        min={from || undefined}
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="w-full min-w-0 bg-transparent text-xs text-app-text outline-none"
                      />
                    </div>
                  </div>

                  {rangeInvalid ? (
                    <p className="text-[11px] text-app-danger-text" role="alert">
                      Start date cannot be after end date.
                    </p>
                  ) : (
                    <p className="text-[10px] text-app-text-subtle">
                      Filter documents indexed within this date range.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
