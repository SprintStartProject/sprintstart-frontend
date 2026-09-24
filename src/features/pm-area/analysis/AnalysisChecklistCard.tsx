import { ArrowUpRight, ChevronDown, ListChecks, X } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Checkbox } from "../../../components/ui/Checkbox";
import { formatRelativeDate } from "../../knowledge-gaps/format";
import { PmCard, PmCardHeader } from "../components/PmCard";
import { AREA_META, SEVERITY_META, SEVERITY_RANK } from "./analysisMeta";
import type { ChecklistItem } from "./analysisStorage";
import { useAnalysisChecklist } from "./useAnalysisChecklist";

function ChecklistRow({ item, onToggle }: { item: ChecklistItem; onToggle: () => void }) {
  const id = useId();
  const severity = SEVERITY_META[item.severity];
  const SeverityIcon = severity.icon;
  const AreaIcon = AREA_META[item.area].icon;

  return (
    <li className="flex items-start gap-3 py-2">
      <Checkbox id={id} checked={item.done} onChange={onToggle} className="mt-0.5" />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span
          className={`block text-sm ${item.done ? "text-app-text-subtle line-through" : "text-app-text"}`}
        >
          {item.title}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-app-text-muted">
          <SeverityIcon aria-hidden="true" className={`h-3 w-3 shrink-0 ${severity.text}`} />
          <span className="sr-only">{severity.label}:</span>
          <AreaIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
          <span className="truncate">{AREA_META[item.area].label}</span>
        </span>
      </label>
      {item.to && (
        <Link
          to={item.to}
          aria-label={`Open: ${item.title}`}
          title="Open"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-app-text-subtle transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
        >
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      )}
    </li>
  );
}

/** How many items the card lists before "Show all" — the overview is not the place for 16. */
const COLLAPSED_ITEMS = 6;

/**
 * The checklist a manager kept from a project analysis, on the overview: what the analysis found,
 * to tick off one by one — open first, most serious first, done at the bottom.
 *
 * Only while there is one. It is a snapshot of that run: ticking an item off records that the
 * manager dealt with it, it does not re-check the project (the next analysis does that).
 */
export function AnalysisChecklistCard() {
  const { checklist, toggle, remove } = useAnalysisChecklist();
  const [expanded, setExpanded] = useState(false);
  if (!checklist || checklist.items.length === 0) return null;

  const done = checklist.items.filter((item) => item.done).length;
  const total = checklist.items.length;
  const sorted = [...checklist.items].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );

  return (
    <PmCard aria-label="Checklist from the analysis" tone="brand">
      <PmCardHeader
        icon={ListChecks}
        tone="brand"
        title="Checklist from the analysis"
        meta={`${done} of ${total} done · ${formatRelativeDate(checklist.analysedAt)}`}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={remove}
            icon={<X className="h-3.5 w-3.5" />}
            title="Remove the checklist from the overview"
          >
            {done === total ? "Clear" : "Remove"}
          </Button>
        }
      />
      <span
        aria-hidden="true"
        className="-mt-1 mb-2 block h-1.5 overflow-hidden rounded-full bg-app-progress-track"
      >
        <span
          className="block h-full rounded-full bg-gradient-to-r from-app-progress-fill to-app-progress-fill-end transition-[width] duration-500"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </span>
      <ul className="grid gap-x-8 divide-y divide-app-border-muted md:grid-cols-2 md:divide-y-0">
        {(expanded ? sorted : sorted.slice(0, COLLAPSED_ITEMS)).map((item) => (
          <ChecklistRow key={item.id} item={item} onToggle={() => toggle(item.id)} />
        ))}
      </ul>
      {sorted.length > COLLAPSED_ITEMS && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          icon={
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          }
          className="mt-1 self-start"
        >
          {expanded ? "Show less" : `Show all ${sorted.length}`}
        </Button>
      )}
    </PmCard>
  );
}
