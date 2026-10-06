import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Check, Filter, RotateCcw, TriangleAlert, X } from "lucide-react";
import { centralSpringToken } from "../../../styles/tokens";
import { SOURCE_META } from "../../data-ingestion/data";
import type { SourceSystem } from "../../data-ingestion/connectors/sourceSystems";
import { useAvailableSources } from "../hooks/useAvailableSources";
import { isFilterRangeInvalid } from "../utils/filterRange";
import type { BuddySessionFilters } from "../types";

function formatDateFilterLabel(from: string, to: string): string {
  if (from && to) return `${from} → ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return "";
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type SourceMeta = (typeof SOURCE_META)[SourceSystem];

/**
 * Resolves the display metadata for a source system.
 *
 * `SOURCE_META` is typed as a complete record, so the fallback branch is unreachable per the
 * type; it stays as runtime defense against unmapped or unexpected source values arriving over
 * the wire.
 */
function getSourceMeta(source: SourceSystem): SourceMeta {
  return (
    SOURCE_META[source] ?? {
      name: source,
      type: source,
      description: source,
      icon: Filter,
    }
  );
}

/** The active filter count both the toggle's badge and the chips strip report. */
function activeFilterCount(filters: BuddySessionFilters): number {
  return filters.sourceSystems.length + (filters.from || filters.to ? 1 : 0);
}

type BuddyFilterChipsProps = {
  filters: BuddySessionFilters;
  onFiltersChange: (next: BuddySessionFilters) => void;
};

/**
 * The active filters, as removable chips above the composer — visible whenever any is set, so
 * a narrowed search is never invisible (one of the ways a filtered conversation "loses" its
 * knowledge: the hire forgot the lens was still on).
 */
export function BuddyFilterChips({ filters, onFiltersChange }: BuddyFilterChipsProps) {
  const toggleSource = (source: SourceSystem) => {
    const next = filters.sourceSystems.includes(source)
      ? filters.sourceSystems.filter((system) => system !== source)
      : [...filters.sourceSystems, source];
    onFiltersChange({ ...filters, sourceSystems: next });
  };

  return (
    <AnimatePresence>
      {activeFilterCount(filters) > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: 4 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={{ opacity: 0, height: 0, y: 4 }}
          transition={centralSpringToken}
          className="mb-2.5 flex flex-wrap items-center gap-1.5 overflow-hidden px-1"
        >
          <span className="mr-0.5 flex items-center gap-1 text-2xs font-semibold tracking-wider text-app-text-muted uppercase">
            <Filter size={11} className="text-app-brand" />
            <span>Filtering:</span>
          </span>

          {filters.sourceSystems.map((source) => {
            const meta = getSourceMeta(source);
            const Icon = meta.icon;
            return (
              <button
                key={source}
                type="button"
                onClick={() => toggleSource(source)}
                aria-label={`Remove ${meta.type} filter`}
                title={`Remove ${meta.type} filter`}
                className="group inline-flex items-center gap-1.5 rounded-full border border-app-brand-border bg-app-brand/10 px-2.5 py-0.5 text-xs font-medium text-app-brand-text transition-colors hover:border-app-danger-border hover:bg-app-danger-bg hover:text-app-danger-text"
              >
                <Icon size={12} className="shrink-0 opacity-80 group-hover:opacity-100" />
                <span>{meta.type}</span>
                <X size={11} className="shrink-0 opacity-60 group-hover:opacity-100" />
              </button>
            );
          })}

          {(filters.from || filters.to) && (
            <button
              type="button"
              onClick={() => onFiltersChange({ ...filters, from: "", to: "" })}
              aria-label="Clear date filter"
              title="Clear date filter"
              className="group inline-flex items-center gap-1.5 rounded-full border border-app-brand-border bg-app-brand/10 px-2.5 py-0.5 text-xs font-medium text-app-brand-text transition-colors hover:border-app-danger-border hover:bg-app-danger-bg hover:text-app-danger-text"
            >
              <Calendar size={12} className="shrink-0 opacity-80 group-hover:opacity-100" />
              <span>{formatDateFilterLabel(filters.from, filters.to)}</span>
              <X size={11} className="shrink-0 opacity-60 group-hover:opacity-100" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onFiltersChange({ sourceSystems: [], from: "", to: "" })}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-app-text-subtle transition-colors hover:bg-app-surface-hover hover:text-app-text"
          >
            <RotateCcw size={11} />
            <span>Clear all</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type BuddyFiltersButtonProps = {
  filters: BuddySessionFilters;
  onFiltersChange: (next: BuddySessionFilters) => void;
};

/**
 * The composer's source/date filter control: a toggle that opens a popover of the source
 * systems that actually exist right now, plus an indexed-date window — ported from the chat
 * composer, which is where these filters were built, so the one conversation the hire now has
 * can still narrow what its answers may draw on.
 *
 * Not rendered in the dock's compact layout (see `BuddyComposer`): a 384 px panel has no room
 * for a popover, and the chips strip above the composer still shows what is active.
 */
export function BuddyFiltersButton({ filters, onFiltersChange }: BuddyFiltersButtonProps) {
  const [showFilters, setShowFilters] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { sources: availableSources, loading: sourcesLoading } = useAvailableSources();

  // Close the floating popover on Escape or a click outside it.
  useEffect(() => {
    if (!showFilters) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setShowFilters(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowFilters(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showFilters]);

  const count = activeFilterCount(filters);

  const toggleSourceSystem = (source: SourceSystem) => {
    const next = filters.sourceSystems.includes(source)
      ? filters.sourceSystems.filter((system) => system !== source)
      : [...filters.sourceSystems, source];
    onFiltersChange({ ...filters, sourceSystems: next });
  };

  const clearFilters = () => onFiltersChange({ sourceSystems: [], from: "", to: "" });

  const setPastDays = (days: number) => {
    const now = new Date();
    const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
    onFiltersChange({ ...filters, from: formatLocalDate(past), to: formatLocalDate(now) });
  };

  const today = formatLocalDate(new Date());

  const diffDays =
    filters.from && filters.to
      ? Math.round(
          (new Date(`${filters.to}T00:00:00`).getTime() -
            new Date(`${filters.from}T00:00:00`).getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : null;

  const isAllTime = !filters.from && !filters.to;
  const isPast7Days = filters.to === today && diffDays === 7;
  const isPast30Days = filters.to === today && diffDays === 30;
  const rangeInvalid = isFilterRangeInvalid(filters.from, filters.to);

  const presetClass = (active: boolean) =>
    `rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
      active
        ? "bg-app-brand font-semibold text-white shadow-xs"
        : "border border-app-border bg-app-surface text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
    }`;

  // Shared wrapper for the From/To date inputs: both must show the same
  // invalid-range treatment (danger border) as the error text below them.
  const dateRangeWrapperClass = `flex flex-1 items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors focus-within:ring-1 focus-within:ring-app-focus ${
    rangeInvalid ? "border-app-danger-border" : "border-app-border"
  }`;

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Toggle source filters"
        aria-expanded={showFilters}
        data-testid="buddy-filters-toggle"
        onClick={() => setShowFilters((open) => !open)}
        className={`relative flex size-9 shrink-0 items-center justify-center rounded-xl border transition-all ${
          showFilters || count > 0
            ? "border-app-brand-border-strong bg-app-brand/10 text-app-brand-text shadow-xs"
            : "border-app-border-muted bg-app-surface text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
        }`}
      >
        <Filter size={18} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-app-brand text-xs font-bold text-white shadow-sm ring-1 ring-app-surface">
            {count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={centralSpringToken}
            onKeyDown={(e) => {
              // Single guard for implicit form submission: Enter inside an
              // input of the popover (e.g. the date fields) is cancelled
              // before it bubbles further, while Enter on buttons keeps
              // its keyboard activation. This one handler covers every
              // input the popover contains — individual inputs must not
              // add their own copy.
              if (e.key === "Enter" && (e.target as HTMLElement)?.tagName === "INPUT") {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            className="absolute bottom-full left-0 z-30 mb-3 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-app-border/80 bg-app-surface/95 p-4 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:w-[380px]"
          >
            <div className="flex items-center justify-between border-b border-app-border-muted/70 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-lg bg-app-brand/10 text-app-brand">
                  <Filter size={13} />
                </div>
                <h3 className="text-xs font-semibold text-app-text">Filter knowledge sources</h3>
              </div>

              <div className="flex items-center gap-1.5">
                {count > 0 && (
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
                  onClick={() => setShowFilters(false)}
                  aria-label="Close filters"
                  className="flex size-6 items-center justify-center rounded-md text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-semibold tracking-wider text-app-text-muted uppercase">
                  Sources
                </span>
                <span className="text-xs text-app-text-subtle">
                  {filters.sourceSystems.length === 0
                    ? "Searching all sources"
                    : `${filters.sourceSystems.length} selected`}
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
                    const selected = filters.sourceSystems.includes(source);
                    const meta = getSourceMeta(source);
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

            <div className="my-3 h-px bg-app-border-muted/60" />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-semibold tracking-wider text-app-text-muted uppercase">
                  Indexed Date
                </span>
                {(filters.from || filters.to) && (
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, from: "", to: "" })}
                    className="text-xs font-medium text-app-brand-text hover:underline"
                  >
                    Clear dates
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={isAllTime}
                  onClick={() => onFiltersChange({ ...filters, from: "", to: "" })}
                  className={presetClass(isAllTime)}
                >
                  All time
                </button>
                <button
                  type="button"
                  aria-pressed={isPast7Days}
                  onClick={() => setPastDays(7)}
                  className={presetClass(isPast7Days)}
                >
                  Past 7 days
                </button>
                <button
                  type="button"
                  aria-pressed={isPast30Days}
                  onClick={() => setPastDays(30)}
                  className={presetClass(isPast30Days)}
                >
                  Past 30 days
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <div className={dateRangeWrapperClass}>
                  <span className="text-2xs font-semibold tracking-wide text-app-text-disabled uppercase">
                    From
                  </span>
                  <input
                    id="buddy-filter-from"
                    type="date"
                    aria-label="Earliest date"
                    max={filters.to || undefined}
                    value={filters.from}
                    onChange={(e) => onFiltersChange({ ...filters, from: e.target.value })}
                    className="w-full min-w-0 bg-transparent text-xs text-app-text outline-hidden"
                  />
                </div>

                <span className="text-xs text-app-text-disabled">→</span>

                <div className={dateRangeWrapperClass}>
                  <span className="text-2xs font-semibold tracking-wide text-app-text-disabled uppercase">
                    To
                  </span>
                  <input
                    id="buddy-filter-to"
                    type="date"
                    aria-label="Latest date"
                    min={filters.from || undefined}
                    value={filters.to}
                    onChange={(e) => onFiltersChange({ ...filters, to: e.target.value })}
                    className="w-full min-w-0 bg-transparent text-xs text-app-text outline-hidden"
                  />
                </div>
              </div>

              {rangeInvalid ? (
                <p className="flex items-start gap-1.5 text-xs text-app-danger-text" role="alert">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Start date cannot be after end date.
                </p>
              ) : (
                <p className="text-xs text-app-text-subtle">
                  Filter documents indexed within this date range.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
