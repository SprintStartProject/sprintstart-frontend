import { FilterSelect } from "../../../components/ui/FilterSelect.tsx";
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
 * A `FilterSelect` with a visible label rather than an icon-only picker: the
 * number alone ("50") does not say what it counts. It lives next to `Pagination`
 * instead of inside it because `Pagination` renders nothing on a single page, and
 * a reader who picked 100 must still see what they picked.
 */
export function ArtifactPageSizeSelect({
  pageSize,
  onPageSizeChange,
  className = "",
}: ArtifactPageSizeSelectProps) {
  const sizes = PAGE_SIZE_OPTIONS.includes(pageSize)
    ? PAGE_SIZE_OPTIONS
    : [...PAGE_SIZE_OPTIONS, pageSize].sort((a, b) => a - b);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span aria-hidden="true" className="text-sm whitespace-nowrap text-app-text-muted">
        Per page
      </span>
      {/* The trigger is `w-full`; the width lives on the wrapper. */}
      <div className="w-24">
        <FilterSelect
          label="Per page"
          value={String(pageSize)}
          options={sizes.map((size) => ({ value: String(size), label: String(size) }))}
          onChange={(value) => onPageSizeChange(Number(value))}
          testId="kb-page-size"
        />
      </div>
    </div>
  );
}
