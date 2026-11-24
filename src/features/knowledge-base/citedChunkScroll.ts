function lineRangeContaining(container: HTMLElement, line: number): HTMLElement | null {
  for (const el of container.querySelectorAll<HTMLElement>("[data-line-start]")) {
    const start = Number(el.dataset.lineStart);
    const end = Number(el.dataset.lineEnd || start);
    if (line >= start && line <= end) return el;
  }
  return null;
}

/**
 * The element that shows the cited line: the one anchored at that line, else any element
 * already marked as holding a cited line, else the first one whose line span covers it.
 */
export function findCitedElement(container: HTMLElement, line: number): HTMLElement | null {
  return (
    container.querySelector<HTMLElement>(`#line-${line}`) ??
    container.querySelector<HTMLElement>("[data-highlighted='true']") ??
    lineRangeContaining(container, line)
  );
}

/** Scrolls the first cited line into the middle of the view; true when something was found. */
export function scrollToCitedLines(
  container: HTMLElement | null,
  highlightLines: number[] | undefined,
): boolean {
  if (!container || !highlightLines || highlightLines.length === 0) return false;
  const target = findCitedElement(container, Math.min(...highlightLines));
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  return target !== null;
}
