import { Check, Filter, Send, Square } from "lucide-react";
import type { FormEvent, RefObject } from "react";
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
    /**
     * Whether a project is selected. Without one there is nothing to scope retrieval to, so
     * sending is blocked here rather than failing silently after the fact.
     */
    hasProject: boolean;

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
    const blocked = rangeInvalid || !hasProject;

    return (
        <footer className="shrink-0 border-t border-app-border bg-app-bg app-page-frame py-4">
            {showFilters && (
                <div className="mb-3">
                    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-app-border bg-app-surface-muted/70 backdrop-blur px-4 py-3">
                        <div className="flex flex-col gap-1">
                            <label
                                htmlFor="filter-from"
                                className="text-xs font-medium text-app-text-muted tracking-wide uppercase font-semibold"
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
                                className="text-xs font-medium text-app-text-muted tracking-wide uppercase font-semibold"
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

                        <div className="h-8 w-px bg-app-border-muted self-center hidden lg:block" />

                        <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-app-text-muted tracking-wide uppercase font-semibold">
                                    Systems
                                </span>
                                {activeFilterCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="text-xs font-semibold text-app-text-muted hover:text-app-brand transition-colors"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>

                            <div
                                role="group"
                                aria-label="Source systems"
                                className="flex flex-wrap gap-2 min-h-10 items-center"
                            >
                                {SOURCE_SYSTEMS.map((source) => {
                                    const selected = sourceSystems.includes(source);

                                    return (
                                        <button
                                            key={source}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => toggleSourceSystem(source)}
                                            className={`h-10 rounded-full px-4 text-xs font-semibold uppercase tracking-wide border transition-colors flex items-center gap-1.5 ${
                                                selected
                                                    ? "bg-app-brand text-white border-app-brand"
                                                    : "bg-app-bg border-app-border text-app-text hover:bg-app-surface"
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
                    className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-app-surface border border-app-border-muted text-app-text-muted hover:bg-app-surface-hover hover:text-app-text transition-colors"
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
