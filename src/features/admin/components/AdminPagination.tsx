import { ChevronLeft, ChevronRight } from "lucide-react";

type AdminPaginationProps = {
    safePage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
};

export function AdminPagination({
    safePage,
    totalPages,
    onPageChange,
}: AdminPaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <div className="mt-4 flex items-center justify-start gap-1 overflow-x-auto pb-1 sm:justify-center">
            <button
                type="button"
                onClick={() => onPageChange(Math.max(1, safePage - 1))}
                disabled={safePage === 1}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-app-text-muted"
                aria-label="Previous page"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (pageNumber) => (
                    <button
                        key={pageNumber}
                        type="button"
                        onClick={() => onPageChange(pageNumber)}
                        className={`flex h-11 w-11 items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                            safePage === pageNumber
                                ? "bg-app-surface-muted text-app-text"
                                : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                        }`}
                    >
                        {pageNumber}
                    </button>
                ),
            )}

            <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
                disabled={safePage === totalPages}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-app-text-muted"
                aria-label="Next page"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
}
