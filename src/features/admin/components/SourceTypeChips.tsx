import { Database } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { getSourceTypeMeta, groupSourcesByType } from "../data";
import type { ProjectSource } from "../types";

type SourceTypeChipsProps = {
  sources: Pick<ProjectSource, "type">[];
  /** Types shown before the rest collapse into a `+N` chip. */
  maxVisible?: number;
  className?: string;
};

/**
 * One chip per source type of a project — icon, label and, when there is more
 * than one, how many (`GitHub ×2`).
 *
 * Icon and label come from the Data Ingestion metadata, so a type reads the
 * same here as on that page. A type the frontend has no metadata for gets the
 * generic `Database` icon instead of vanishing.
 */
export function SourceTypeChips({ sources, maxVisible = 3, className = "" }: SourceTypeChipsProps) {
  const groups = groupSourcesByType(sources);

  if (groups.length === 0) return null;

  const visibleGroups = groups.slice(0, maxVisible);
  const hiddenCount = groups.length - visibleGroups.length;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`.trim()}>
      {visibleGroups.map((group) => {
        const Icon = getSourceTypeMeta(group.type)?.icon ?? Database;

        return (
          <Badge key={group.type} variant="neutral" size="sm">
            <Icon className="mr-1 h-3 w-3 shrink-0" aria-hidden="true" />
            {group.label}
            {group.count > 1 ? ` ×${group.count}` : ""}
          </Badge>
        );
      })}

      {hiddenCount > 0 && (
        <Badge variant="neutral" size="sm" title={`${hiddenCount} more source types`}>
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}
