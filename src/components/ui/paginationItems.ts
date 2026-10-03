/** Up to this many pages every number is shown; beyond it the strip collapses with ellipses. */
const MAX_PAGES_WITHOUT_ELLIPSIS = 7;

/** Pages shown at the edge when the current page sits near it, e.g. `1 2 3 4 5 ... 20`. */
const EDGE_RUN_LENGTH = 5;

export type PageItem = number | "start-ellipsis" | "end-ellipsis";

/**
 * The page numbers (and ellipsis markers) a pagination strip should render. The strip always has
 * the same number of slots once it collapses (first page, last page, the current page with one
 * neighbour each side, and two ellipses), so the buttons don't shift sideways while paging. Near
 * either edge the ellipsis on that side gives way to a longer run of numbers.
 */
export function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= MAX_PAGES_WITHOUT_ELLIPSIS) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= EDGE_RUN_LENGTH - 1) {
    const run = Array.from({ length: EDGE_RUN_LENGTH }, (_, index) => index + 1);
    return [...run, "end-ellipsis", totalPages];
  }

  if (currentPage >= totalPages - (EDGE_RUN_LENGTH - 2)) {
    const run = Array.from(
      { length: EDGE_RUN_LENGTH },
      (_, index) => totalPages - EDGE_RUN_LENGTH + 1 + index,
    );
    return [1, "start-ellipsis", ...run];
  }

  return [
    1,
    "start-ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "end-ellipsis",
    totalPages,
  ];
}
