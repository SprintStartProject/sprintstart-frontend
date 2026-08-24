export type PoolFlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type PoolFlightItem = {
  id: number;
  title: string;
  summary?: string | null;
  origin: PoolFlightRect;
};

/** Snapshot an action before its row, drawer or modal disappears after a successful request. */
export function capturePoolFlightRect(element: HTMLElement): PoolFlightRect {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}
