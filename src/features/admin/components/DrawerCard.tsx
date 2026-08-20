import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type DrawerCardProps = {
  /** Uppercase section label shown in the card header. Omit for a headerless card. */
  label?: string;
  /** Optional lucide icon rendered in a soft tile beside the label. */
  icon?: LucideIcon;
  /** Position in the body stack, so cards reveal in sequence when the drawer opens. */
  index?: number;
  /** Optional trailing content in the header row (counts, actions). */
  headerAccessory?: ReactNode;
  /** `danger` swaps the neutral surface for the destructive palette. */
  variant?: "default" | "danger";
  /**
   * Drops the card's own surface/border/padding and keeps only the entrance
   * motion, for children that already bring their own container.
   */
  bare?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * One body section of a detail drawer, styled as a contained surface card that
 * fades and rises into place on open.
 *
 * The stagger is driven by `index` so a card animates itself without a
 * coordinating parent — cards can sit in different conditional branches and
 * still reveal in sequence. `useReducedMotion` collapses the entrance to an
 * instant appearance, matching the drawer shell's own motion guard.
 */
export function DrawerCard({
  label,
  icon: Icon,
  index = 0,
  headerAccessory,
  variant = "default",
  bare = false,
  className = "",
  children,
}: DrawerCardProps) {
  const prefersReducedMotion = useReducedMotion();

  const container = bare
    ? ""
    : variant === "danger"
      ? "rounded-2xl border border-app-danger-border bg-app-danger-bg p-5 sm:p-6"
      : "rounded-2xl border border-app-border bg-app-surface p-5 sm:p-6";

  const labelTone = variant === "danger" ? "text-app-danger-text" : "text-app-text-muted";

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.35, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }
      }
      className={`${container} ${className}`.trim()}
    >
      {(label || headerAccessory) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-app-brand-soft text-app-brand">
                <Icon className="h-4 w-4" />
              </span>
            )}
            {label && (
              <p className={`text-xs font-semibold tracking-wide uppercase ${labelTone}`}>{label}</p>
            )}
          </div>
          {headerAccessory}
        </div>
      )}

      {children}
    </motion.section>
  );
}
