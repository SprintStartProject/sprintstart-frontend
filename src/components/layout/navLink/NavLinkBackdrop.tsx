import { motion, type MotionValue } from "framer-motion";
import { slidingIndicatorSpringToken } from "../../../styles/tokens";

type NavLinkBackdropProps = {
  isHighlighted: boolean;
  indicatorLayoutId: string;
  prefersReducedMotion: boolean;
  tintOpacity: MotionValue<number>;
  ringOpacity: MotionValue<number>;
};

/**
 * The selected row's share of the hover tint. It exists because this row was otherwise a hole in the
 * falloff. Every other entry hands its tint to its neighbour so the two always sum to one row's
 * worth, but a pill with no tint contributes nothing and takes its neighbour's half down with it.
 *
 * It runs `tintOpacity` — the very same value every other row fades its fill in on — so the partition
 * is exact; only the paint differs, because the muted surface colour the others use would be mud over
 * brand blue. No ring on this one: the pill is already a solid shape with its own edge, and outlining
 * it would say "hovered" in the same breath as "selected". Under reduced motion it falls back to the
 * same binary `group-hover` its neighbours use.
 */
function ActivePill({
  indicatorLayoutId,
  prefersReducedMotion,
  tintOpacity,
}: Omit<NavLinkBackdropProps, "isHighlighted" | "ringOpacity">) {
  const indicatorTransition = prefersReducedMotion ? { duration: 0 } : slidingIndicatorSpringToken;

  // Flat, single-tone fill on purpose: gradients or specular edges read as uneven next to the plain
  // brand colour used elsewhere in the app. The depth comes from the soft glow alone.
  //
  // The `key` is what makes the pill slide. Both this and the hover tint are `motion.span` in the
  // same slot, so without distinct keys React reconciles them as one element and merely swaps
  // `layoutId` on a node that never unmounts. Framer Motion pairs a shared element by watching one
  // mount as another unmounts, so that swap gave it nothing to measure against and the pill appeared
  // at the new entry outright. Separate keys restore the unmount/mount pair.
  return (
    <motion.span
      key="active-pill"
      aria-hidden="true"
      layoutId={indicatorLayoutId}
      transition={indicatorTransition}
      className="absolute inset-0 rounded-[10px] bg-app-brand shadow-[0_6px_20px_-8px_var(--color-app-brand)]"
    >
      {prefersReducedMotion ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-[10px] bg-app-brand-border-strong opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
        />
      ) : (
        <motion.span
          aria-hidden="true"
          style={{ opacity: tintOpacity }}
          className="absolute inset-0 rounded-[10px] bg-app-brand-border-strong"
        />
      )}
    </motion.span>
  );
}

/**
 * Tied to the same influence as the lift rather than to `:hover`. A binary hover tint snaps on and
 * off one row at a time, which is what made the magnification look like it jumped between neighbours
 * instead of travelling through them. Runs the tint curve at one row pitch, so the sidebar carries a
 * single row's worth of fill in total and it never competes with the brand pill for the reading of
 * "selected". The inset ring nested inside is the other half: a hard 1px border turns "roughly around
 * here" into a stated target the eye can land on.
 */
function HoverTint({
  prefersReducedMotion,
  tintOpacity,
  ringOpacity,
}: Omit<NavLinkBackdropProps, "isHighlighted" | "indicatorLayoutId">) {
  if (prefersReducedMotion) {
    return (
      <span
        key="hover-tint-static"
        aria-hidden="true"
        className="absolute inset-0 rounded-[10px] bg-app-surface-hover opacity-0 ring-1 ring-app-border-muted transition-opacity duration-300 ease-out ring-inset group-hover:opacity-100"
      />
    );
  }

  return (
    <motion.span
      key="hover-tint"
      aria-hidden="true"
      style={{ opacity: tintOpacity }}
      className="absolute inset-0 rounded-[10px] bg-app-surface-hover"
    >
      <motion.span
        style={{ opacity: ringOpacity }}
        className="absolute inset-0 rounded-[10px] ring-1 ring-app-border-muted ring-inset"
      />
    </motion.span>
  );
}

/** What sits behind an entry: the sliding active pill, or the pointer-following hover tint. */
export function NavLinkBackdrop({ isHighlighted, ...rest }: NavLinkBackdropProps) {
  return isHighlighted ? <ActivePill {...rest} /> : <HoverTint {...rest} />;
}
