import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { getMySkillLevels, getMyTeamOverview } from "../../../services/teamManagementService";
import type { UserSkillLevel } from "../../../services/teamManagementService";
import type { ProjectRole } from "../../team-management/types";
import type { DashboardWidgetSize } from "../layout/types";

/** Filled dots per level — mirrors the team member detail panel. */
const LEVEL_DOTS: Record<string, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

const VISIBLE_SKILL_COUNT = 6;

function SkillPill({ skill, large }: { skill: UserSkillLevel; large: boolean }) {
  const filled = LEVEL_DOTS[skill.level] ?? 0;

  return (
    <span
      title={`${skill.skillName} — ${skill.level.toLowerCase()}`}
      className={`inline-flex items-center gap-2 rounded-full border border-app-border-muted bg-app-surface-muted ${
        large ? "px-4 py-2" : "px-3 py-1.5"
      }`}
    >
      <span className={`font-medium text-app-text ${large ? "text-sm" : "text-xs"}`}>
        {skill.skillName}
      </span>

      <span aria-hidden="true" className="flex gap-0.5">
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className={`rounded-full ${large ? "h-2 w-2" : "h-1.5 w-1.5"} ${
              index < filled ? "bg-app-brand" : "bg-app-border"
            }`}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * The user's project roles and their assessed skill levels — the "who am I here" card.
 *
 * A single line across a whole row, and a stacked block at anything narrower. The wide form
 * reads as a strip because everything fits on one baseline; the same markup at half the
 * width wraps into a ragged three-line paragraph, so the narrow form gives the roles and the
 * skills a row each instead.
 *
 * The narrow forms also set their pills a size larger. This card carries the least of any on
 * the board, and at pill sizes tuned for a one-line strip it read as a few crumbs adrift in
 * a fixed-height cell.
 */
export function SkillsStrip({ size }: { size: DashboardWidgetSize }) {
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [skills, setSkills] = useState<UserSkillLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCurrentRequest = true;

    async function loadProfile() {
      const [overview, skillLevels] = await Promise.all([
        getMyTeamOverview().catch(() => null),
        getMySkillLevels(),
      ]);

      if (!isCurrentRequest) return;

      setRoles(overview?.roles ?? []);
      setSkills(skillLevels);
      setLoading(false);
    }

    void loadProfile();

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  if (loading) return null;

  const isWide = size === "wide";
  // A quarter-row card fits fewer pills before it starts a fourth line of its own.
  const visibleSkills = skills.slice(0, size === "small" ? 3 : VISIBLE_SKILL_COUNT);
  const hiddenCount = skills.length - visibleSkills.length;

  return (
    <div
      className={`flex h-full gap-x-4 gap-y-3 rounded-2xl px-5 py-4 ${
        isWide
          ? "flex-wrap items-center justify-center"
          : "flex-col items-center justify-center text-center"
      }`}
    >
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-app-brand" />
        <span className="text-xs font-semibold tracking-widest text-app-text-muted uppercase">
          Role &amp; skills
        </span>
      </div>

      {roles.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {roles.map((role) => (
            <Badge
              key={role.id}
              variant="brand"
              className={isWide ? "px-2.5 py-1" : "px-3 py-1.5 text-sm"}
            >
              {role.name}
            </Badge>
          ))}
        </div>
      )}

      {visibleSkills.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {visibleSkills.map((skill) => (
            <SkillPill key={skill.id} skill={skill} large={!isWide} />
          ))}

          {hiddenCount > 0 && (
            <span className="text-xs text-app-text-muted">+{hiddenCount} more</span>
          )}
        </div>
      ) : (
        <span className="text-xs text-app-text-muted">No skills assessed yet.</span>
      )}
    </div>
  );
}
