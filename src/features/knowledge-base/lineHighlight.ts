export type UnistPosition = {
  start: { line: number; column: number; offset?: number };
  end: { line: number; column: number; offset?: number };
};

export type HastNode = {
  type?: string;
  tagName?: string;
  position?: UnistPosition;
};

/**
 * Checks whether an AST node's line position intersects with the requested highlight lines.
 */
export function isNodeHighlighted(
  node?: HastNode,
  highlightLines?: number[],
): { isHighlighted: boolean; startLine?: number; endLine?: number } {
  if (!highlightLines || highlightLines.length === 0 || !node?.position) {
    return { isHighlighted: false };
  }
  const start = node.position.start.line;
  const end = node.position.end.line;
  const isHighlighted = highlightLines.some((line) => line >= start && line <= end);
  return { isHighlighted, startLine: start, endLine: end };
}

export function formatLineRanges(lines?: number[]): string {
  if (!lines || lines.length === 0) return "";
  const sorted = [...new Set(lines)].sort((a, b) => a - b);
  if (sorted.length === 1) return `Line ${sorted[0]}`;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (last === first) return `Line ${first}`;
  return `Lines ${first}–${last}`;
}
