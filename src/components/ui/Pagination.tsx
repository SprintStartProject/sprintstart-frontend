import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    className?: string;
}

/**
 * Page navigation with ellipsis collapsing. Shows max 5 page buttons.
 * Collapses entirely when totalPages <= 1.
 */
export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
    if (totalPages <= 1) return null;

    const maxVisiblePages = 5;
    
    const getPageNumbers = () => {
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = startPage + maxVisiblePages - 1;

        if (endPage > totalPages) {
            endPage = totalPages;
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        const pages = [];
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        return pages;
    };

    const pages = getPageNumbers();

    return (
        <nav
            className={`flex items-center justify-center space-x-1 mt-6 ${className || ''}`}
            aria-label="Pagination"
        >
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-app-border bg-app-surface text-app-text transition-colors hover:bg-app-background focus:outline-none focus:ring-2 focus:ring-app-brand/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-app-surface"
                aria-label="Previous page"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            {pages[0] > 1 && (
                <>
                    <button
                        onClick={() => onPageChange(1)}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-transparent text-app-text-muted transition-colors hover:bg-app-surface hover:text-app-text focus:outline-none focus:ring-2 focus:ring-app-brand/50"
                    >
                        1
                    </button>
                    {pages[0] > 2 && <span className="px-2 text-app-text-muted">...</span>}
                </>
            )}

            {pages.map((page) => (
                <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    aria-current={currentPage === page ? "page" : undefined}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-app-brand/50 ${
                        currentPage === page
                            ? "bg-app-brand text-white shadow-md shadow-app-brand/20"
                            : "border border-transparent text-app-text-muted hover:bg-app-surface hover:text-app-text"
                    }`}
                >
                    {page}
                </button>
            ))}

            {pages[pages.length - 1] < totalPages && (
                <>
                    {pages[pages.length - 1] < totalPages - 1 && <span className="px-2 text-app-text-muted">...</span>}
                    <button
                        onClick={() => onPageChange(totalPages)}
                        className="px-4 py-2 text-sm font-medium rounded-lg border border-transparent text-app-text-muted transition-colors hover:bg-app-surface hover:text-app-text focus:outline-none focus:ring-2 focus:ring-app-brand/50"
                    >
                        {totalPages}
                    </button>
                </>
            )}

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-app-border bg-app-surface text-app-text transition-colors hover:bg-app-background focus:outline-none focus:ring-2 focus:ring-app-brand/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-app-surface"
                aria-label="Next page"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </nav>
    );
}
