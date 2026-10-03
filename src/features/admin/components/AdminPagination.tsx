import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { getPageItems } from "../../../components/ui/paginationItems";

type AdminPaginationProps = {
  safePage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

/**
 * Page controls under the admin tables; on mobile they collapse to previous/next around a page
 * counter. Renders nothing for a single page.
 *
 * Does the same job as `ui/Pagination`. Which of the two stays is an open item in
 * `docs/UI_DESIGN_DECISIONS.md`.
 */
export function AdminPagination({ safePage, totalPages, onPageChange }: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const goToPrevious = () => onPageChange(Math.max(1, safePage - 1));
  const goToNext = () => onPageChange(Math.min(totalPages, safePage + 1));

  return (
    <>
      {/* Mobile: the full number strip turns into a horizontal scroller on narrow
          screens, so collapse it to prev/next around a compact page counter. */}
      <div className="mt-4 flex items-center justify-center gap-3 sm:hidden">
        <Button
          variant="ghost"
          iconOnly
          onClick={goToPrevious}
          disabled={safePage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-sm font-medium text-app-text" aria-live="polite">
          Page {safePage} of {totalPages}
        </span>

        <Button
          variant="ghost"
          iconOnly
          onClick={goToNext}
          disabled={safePage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Desktop: number strip, collapsed with ellipses once there are many pages. */}
      <div className="mt-4 hidden items-center justify-start gap-1 overflow-x-auto pb-1 sm:flex sm:justify-center">
        <Button
          variant="ghost"
          iconOnly
          onClick={goToPrevious}
          disabled={safePage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {getPageItems(safePage, totalPages).map((item) =>
          typeof item === "number" ? (
            <Button
              key={item}
              variant={safePage === item ? "primary" : "ghost"}
              iconOnly
              onClick={() => onPageChange(item)}
              aria-current={safePage === item ? "page" : undefined}
            >
              {item}
            </Button>
          ) : (
            <span key={item} className="px-2 text-app-text-muted" aria-hidden="true">
              ...
            </span>
          ),
        )}

        <Button
          variant="ghost"
          iconOnly
          onClick={goToNext}
          disabled={safePage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
