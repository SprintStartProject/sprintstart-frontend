import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../components/ui/Button";

type AdminPaginationProps = {
  safePage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function AdminPagination({ safePage, totalPages, onPageChange }: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-start gap-1 overflow-x-auto pb-1 sm:justify-center">
      <Button
        variant="ghost"
        iconOnly
        onClick={() => onPageChange(Math.max(1, safePage - 1))}
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
        onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        disabled={safePage === totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
