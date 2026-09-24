/**
 * One slice, bar or stage of a PM chart.
 *
 * Colours are palette utilities that set `color` (`text-app-brand`, `text-app-success-solid`, …):
 * the marks paint in `currentColor`, so every chart follows the light and dark theme through the
 * same tokens as the rest of the app instead of carrying hex values of its own.
 */
export type ChartDatum = {
  key: string;
  label: string;
  value: number;
  /** A `text-app-*` utility; the mark is drawn in `currentColor`. */
  colorClassName: string;
  /** Extra words for the tooltip, e.g. who is in a bin. */
  hint?: string;
};

export function chartTotal(data: readonly ChartDatum[]): number {
  return data.reduce((sum, datum) => sum + Math.max(0, datum.value), 0);
}

export function formatShare(value: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}
