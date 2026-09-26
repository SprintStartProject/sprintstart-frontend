import { useId } from "react";
import { Select } from "../../../components/ui/Select.tsx";
import { PAGE_SIZE_OPTIONS } from "../hooks/useKnowledgeBaseUrlState.ts";

/** Props for {@link ArtifactPageSizeSelect}. */
export interface ArtifactPageSizeSelectProps {
  /** Artifacts per page right now (`?size=`). */
  pageSize: number;
  /** Fired with the chosen size; the caller resets to page 1. */
  onPageSizeChange: (size: number) => void;
  className?: string;
}

/**
 * "Per page" control beside the Knowledge Base pagination.
 *
 * A native `ui/Select` with a visible label rather than an icon-only picker: the
 * number alone ("50") does not say what it counts. It lives next to `Pagination`
 * instead of inside it because `Pagination` renders nothing on a single page, and
 * a reader who picked 100 must still see what they picked.
 */
export function ArtifactPageSizeSelect({
  pageSize,
  onPageSizeChange,
  className = "",
}: ArtifactPageSizeSelectProps) {
  const selectId = useId();
  const sizes = PAGE_SIZE_OPTIONS.includes(pageSize)
    ? PAGE_SIZE_OPTIONS
    : [...PAGE_SIZE_OPTIONS, pageSize].sort((a, b) => a - b);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor={selectId} className="text-sm whitespace-nowrap text-app-text-muted">
        Per page
      </label>
      {/* The field style is `w-full`; a `w-20` on the select itself would fight it. */}
      <div className="w-20">
        <Select
          id={selectId}
          size="sm"
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          data-testid="kb-page-size"
        >
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
