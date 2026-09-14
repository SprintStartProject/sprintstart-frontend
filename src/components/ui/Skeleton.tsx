import type { ReactNode } from "react";

const PULSE = "animate-pulse motion-reduce:animate-none bg-app-surface-muted";

export type SkeletonProps = {
  className?: string;
};

/** A skeleton placeholder shaped like a line of text. */
export function SkeletonLine({ className = "" }: SkeletonProps) {
  return <div aria-hidden="true" className={`h-3.5 rounded-md ${PULSE} ${className}`} />;
}

/** A skeleton placeholder shaped like an arbitrary rectangle — an icon slot, an avatar, a stat figure. */
export function SkeletonBlock({ className = "" }: SkeletonProps) {
  return <div aria-hidden="true" className={`rounded-xl ${PULSE} ${className}`} />;
}

/**
 * Card chrome matching the app's `rounded-2xl border bg-app-surface` list and
 * grid rows, so a page composes its skeleton rows from `SkeletonLine`/
 * `SkeletonBlock` without repeating the border/padding boilerplate.
 */
export function SkeletonCard({
  className = "",
  children,
}: SkeletonProps & { children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-app-border bg-app-surface p-4 ${className}`}>
      {children}
    </div>
  );
}

export type SkeletonGroupProps = {
  /** Announced to screen readers in place of the content that hasn't arrived yet. */
  label?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Wraps a composed skeleton layout with a single `role="status"` announcement,
 * matching {@link import("./Spinner").Spinner} — one announcement for the
 * whole group rather than one per placeholder line.
 */
export function SkeletonGroup({ label = "Loading", className = "", children }: SkeletonGroupProps) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
