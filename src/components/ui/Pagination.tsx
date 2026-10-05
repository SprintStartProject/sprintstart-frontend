import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { getPageItems } from "./paginationItems";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Page navigation that collapses long ranges: up to 7 pages show every number, beyond that only the
 * first and last page and the current page with its neighbours stay, separated by ellipses.
 * Renders nothing when totalPages <= 1.
 */
export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const items = getPageItems(currentPage, totalPages);

  return (
    <nav
      className={`mt-6 flex items-center justify-center space-x-1 ${className || ""}`}
      aria-label="Pagination"
    >
      <Button
        variant="secondary"
        size="sm"
        iconOnly
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="max-sm:h-11 max-sm:w-11"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Below sm the numbered buttons would overflow a narrow row, so they
          collapse to a plain "page X of Y" counter; the prev/next controls
          stay usable. From sm up the full numbered set returns unchanged. */}
      <span className="px-2 text-sm font-medium text-app-text-muted tabular-nums sm:hidden">
        Page {currentPage} of {totalPages}
      </span>

      <div className="hidden items-center space-x-1 sm:flex">
        {items.map((item) =>
          typeof item === "number" ? (
            <Button
              key={item}
              variant={currentPage === item ? "primary" : "ghost"}
              size="sm"
              onClick={() => onPageChange(item)}
              aria-current={currentPage === item ? "page" : undefined}
            >
              {item}
            </Button>
          ) : (
            <span key={item} className="px-2 text-app-text-muted" aria-hidden="true">
              ...
            </span>
          ),
        )}
      </div>

      <Button
        variant="secondary"
        size="sm"
        iconOnly
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="max-sm:h-11 max-sm:w-11"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
