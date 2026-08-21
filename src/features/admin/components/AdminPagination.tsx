import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../components/ui/Button";

type AdminPaginationProps = {
  safePage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

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

      {/* Desktop: unchanged full number strip. */}
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

        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
          <Button
            key={pageNumber}
            variant={safePage === pageNumber ? "primary" : "ghost"}
            iconOnly
            onClick={() => onPageChange(pageNumber)}
            aria-current={safePage === pageNumber ? "page" : undefined}
          >
            {pageNumber}
          </Button>
        ))}

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
