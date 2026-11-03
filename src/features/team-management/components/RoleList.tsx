import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, type ReactNode } from "react";
import { useExpandTransition } from "../roles/useExpandTransition";
import type { ProjectRole, Skill, TeamOverviewUser } from "../types";
import { RoleRow } from "./RoleRow";

type RoleListProps = {
  roles: ProjectRole[];
  openRoleId: string | null;
  skillsOf: (roleId: string) => Skill[];
  membersOf: (roleId: string) => TeamOverviewUser[];
  /** The open role's panel, shown right under its row. */
  detail: ReactNode;
  /** True while the role is still the open one, asked when its panel has finished growing. */
  isStillOpen: (roleId: string) => boolean;
  onSelect: (roleId: string) => void;
  onRequestDelete: (roleId: string) => void;
};

/** One row per role, the open role's panel expanded right under its row. */
export function RoleList({
  roles,
  openRoleId,
  skillsOf,
  membersOf,
  detail,
  isStillOpen,
  onSelect,
  onRequestDelete,
}: RoleListProps) {
  const { transition, prefersReducedMotion } = useExpandTransition();
  const detailRef = useRef<HTMLDivElement>(null);

  /**
   * Brings the opened role into view once it has finished expanding.
   *
   * Waiting for the animation matters: while it runs the panel is still growing, so scrolling to
   * it early aims at a box that is not its final size yet. `block: "nearest"` keeps it to the
   * smallest scroll that works -- if the panel is already visible nothing moves at all.
   */
  const scrollDetailIntoView = useCallback(() => {
    detailRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [prefersReducedMotion]);

  return (
    <ul className="divide-y divide-app-border-muted px-3 py-1.5">
      {roles.map((role) => {
        const open = openRoleId === role.id;
        return (
          <li key={role.id} className="py-0.5">
            <RoleRow
              role={role}
              skills={skillsOf(role.id)}
              members={membersOf(role.id)}
              selected={open}
              onSelect={onSelect}
              onRequestDelete={onRequestDelete}
            />
            <AnimatePresence initial={false}>
              {open && detail && (
                // Height on the wrapper, padding inside: a padded element cannot animate to zero
                // height, it stops at its own padding.
                <motion.div
                  key="role-detail"
                  ref={detailRef}
                  onAnimationComplete={() => {
                    // Also fires for the exit, when there is nothing to scroll to.
                    if (isStillOpen(role.id)) scrollDetailIntoView();
                  }}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={transition}
                  className="min-w-0 overflow-hidden"
                >
                  <div className="px-1 pt-1 pb-3">{detail}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
