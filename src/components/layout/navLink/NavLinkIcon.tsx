import { motion } from "framer-motion";
import type { SidebarIcon } from "../SidebarNavIcons";

type NavLinkIconProps = {
  icon: SidebarIcon;
  isHighlighted: boolean;
  needsAttention: boolean;
  prefersReducedMotion: boolean;
  count: number;
  attentionLabel?: string;
};

function iconColour(needsAttention: boolean, isHighlighted: boolean): string {
  if (needsAttention) return "text-app-warning-solid";
  return isHighlighted ? "text-white" : "text-app-text-muted group-hover:text-app-text";
}

/**
 * The shape that stays when the movement does not: the icon wobbles for the people who can see it
 * move, and this badge is there for everybody else, reduced motion included (WCAG 1.4.1). A count
 * takes its place when there is one. Only rendered when there is something waiting: unconditional,
 * it made every entry in the sidebar announce itself as needing attention.
 */
function AttentionBadge({ attentionLabel }: { attentionLabel?: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-app-warning-solid text-xs leading-none font-bold text-white ring-2 ring-app-surface"
      >
        !
      </span>
      <span className="sr-only">{attentionLabel ?? "Needs attention"}</span>
    </>
  );
}

/**
 * The entry's icon. Colour lives on this wrapper rather than on a `[&_svg]` descendant selector on
 * the link: that selector also caught the attention flag and repainted it white on the active pill.
 * The movement is the whole signal here, and invisible to a screen reader and to anyone with reduced
 * motion on, which is why the colour change is not conditional on it.
 */
export function NavLinkIcon({
  icon: Icon,
  isHighlighted,
  needsAttention,
  prefersReducedMotion,
  count,
  attentionLabel,
}: NavLinkIconProps) {
  return (
    <motion.span
      animate={
        needsAttention && !prefersReducedMotion
          ? { y: [0, -4, 0, -2, 0], rotate: [0, -10, 8, -4, 0] }
          : { y: 0, rotate: 0 }
      }
      transition={
        needsAttention
          ? {
              duration: 0.9,
              // Long pause between bursts: an icon that never stops moving stops being a signal and
              // becomes noise.
              repeatDelay: 2.4,
              repeat: Infinity,
              ease: "easeInOut",
            }
          : { duration: 0.2 }
      }
      className={`relative flex shrink-0 transition-colors ${iconColour(needsAttention, isHighlighted)}`}
    >
      <Icon isActive={isHighlighted} />

      {/* Stands down for a count, which says the same thing and says how many -- both would read out
          "Escalation Inbox, open escalations, 3 open escalations". */}
      {needsAttention && count === 0 && <AttentionBadge attentionLabel={attentionLabel} />}
    </motion.span>
  );
}
