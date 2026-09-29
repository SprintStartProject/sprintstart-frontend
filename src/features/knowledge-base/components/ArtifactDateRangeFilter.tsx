import { useId, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "../../../components/ui/Badge.tsx";
import { Button } from "../../../components/ui/Button.tsx";
import { Input } from "../../../components/ui/Input.tsx";
import { Select } from "../../../components/ui/Select.tsx";
import {
  DATE_RANGE_PRESETS,
  describeDateRange,
  matchPreset,
  resolvePreset,
  type DateRange,
} from "../dateRange.ts";
import type { KnowledgeBaseHistoryMode } from "../hooks/useKnowledgeBaseUrlState.ts";

const ANY = "ANY";
const CUSTOM = "CUSTOM";

/** Props for {@link ArtifactDateRangeFilter}. */
export interface ArtifactDateRangeFilterProps {
  /** The active window, `yyyy-MM-dd` each end, null when open. */
  range: DateRange;
  /**
   * Fired with a valid, ordered range. `mode` is `"replace"` for typing into a date field (one edit,
   * one history entry) and `"push"` for a preset or a clear.
   */
  onRangeChange: (range: DateRange, mode: KnowledgeBaseHistoryMode) => void;
  /** Clock override for tests; presets resolve against it. */
  now?: Date;
}

/**
 * The "Updated" filter: a preset picker (Any time, Last 7/30/90 days, Custom range…) and, for a
 * custom range, two native date fields. It filters on an artifact's last activity — its last
 * content change, or its import date if it never changed.
 *
 * Presets are resolved to absolute dates when picked, so the URL holds a fixed window a link can
 * share. The picker shows the preset a range still equals today, and "Custom range…" once it no
 * longer does. A reversed custom pair is refused with a message rather than written: the backend
 * answers `from > to` with a 400.
 */
export function ArtifactDateRangeFilter({
  range,
  onRangeChange,
  now,
}: ArtifactDateRangeFilterProps) {
  const errorId = useId();
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(range);
  const [syncedRange, setSyncedRange] = useState<DateRange>(range);

  // A range arriving from outside (Back, Clear filters, the chip) replaces whatever was drafted.
  if (syncedRange.from !== range.from || syncedRange.to !== range.to) {
    setSyncedRange(range);
    setDraft(range);
    if (!range.from && !range.to) setIsCustomOpen(false);
  }

  const hasRange = range.from !== null || range.to !== null;
  const preset = hasRange ? matchPreset(range, now) : null;
  const selectValue = isCustomOpen ? CUSTOM : !hasRange ? ANY : (preset?.id ?? CUSTOM);
  const isDraftReversed = draft.from !== null && draft.to !== null && draft.from > draft.to;

  const handlePresetChange = (value: string) => {
    if (value === CUSTOM) {
      setIsCustomOpen(true);
      return;
    }
    setIsCustomOpen(false);
    const picked = DATE_RANGE_PRESETS.find((option) => option.id === value);
    onRangeChange(picked ? resolvePreset(picked, now) : { from: null, to: null }, "push");
  };

  const handleDraftChange = (next: DateRange) => {
    setDraft(next);
    if (next.from !== null && next.to !== null && next.from > next.to) return;
    onRangeChange(next, "replace");
  };

  const chipLabel = describeDateRange(range);

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="kb-date-filter">
      <div className="w-40 shrink-0">
        <Select
          size="sm"
          value={selectValue}
          onChange={(event) => handlePresetChange(event.target.value)}
          aria-label="Filter by last update (changed, or added if never changed)"
          data-testid="kb-date-preset"
        >
          <option value={ANY}>Any time</option>
          {DATE_RANGE_PRESETS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
          <option value={CUSTOM}>Custom range…</option>
        </Select>
      </div>

      {selectValue === CUSTOM && (
        <div
          role="group"
          aria-label="Custom date range"
          className="flex flex-wrap items-center gap-2"
        >
          <div className="w-40">
            <Input
              type="date"
              size="sm"
              value={draft.from ?? ""}
              max={draft.to ?? undefined}
              onChange={(event) =>
                handleDraftChange({ ...draft, from: event.target.value || null })
              }
              aria-label="Updated from"
              invalid={isDraftReversed}
              aria-describedby={isDraftReversed ? errorId : undefined}
              data-testid="kb-date-from"
            />
          </div>
          <span aria-hidden="true" className="text-sm text-app-text-muted">
            –
          </span>
          <div className="w-40">
            <Input
              type="date"
              size="sm"
              value={draft.to ?? ""}
              min={draft.from ?? undefined}
              onChange={(event) => handleDraftChange({ ...draft, to: event.target.value || null })}
              aria-label="Updated to"
              invalid={isDraftReversed}
              aria-describedby={isDraftReversed ? errorId : undefined}
              data-testid="kb-date-to"
            />
          </div>
          {isDraftReversed && (
            <p id={errorId} className="text-xs text-app-danger-text" data-testid="kb-date-error">
              The start date must be on or before the end date.
            </p>
          )}
        </div>
      )}

      {chipLabel && (
        <span className="inline-flex items-center gap-1" data-testid="kb-date-chip">
          <Badge variant="brand" size="sm">
            {chipLabel}
          </Badge>
          <Button
            variant="ghost"
            size="xs"
            iconOnly
            onClick={() => onRangeChange({ from: null, to: null }, "push")}
            aria-label="Clear date range"
            data-testid="kb-date-clear"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </span>
      )}
    </div>
  );
}
