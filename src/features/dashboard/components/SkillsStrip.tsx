import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { getMySkillLevels, getMyTeamOverview } from "../../../services/teamManagementService";
import type { UserSkillLevel } from "../../../services/teamManagementService";
import type { ProjectRole } from "../../team-management/types";

/** Filled dots per level — mirrors the team member detail panel. */
const LEVEL_DOTS: Record<string, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

const VISIBLE_SKILL_COUNT = 6;

function SkillPill({ skill }: { skill: UserSkillLevel }) {
  const filled = LEVEL_DOTS[skill.level] ?? 0;

  return (
    <span
      title={`${skill.skillName} — ${skill.level.toLowerCase()}`}
      className="inline-flex items-center gap-2 rounded-full border border-app-border-muted bg-app-surface-muted px-3 py-1.5"
    >
      <span className="text-xs font-medium text-app-text">{skill.skillName}</span>

      <span aria-hidden="true" className="flex gap-0.5">
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 w-1.5 rounded-full ${
              index < filled ? "bg-app-brand" : "bg-app-border"
            }`}
          />
        ))}
      </span>
    </span>
  );
}

/**
 * Slim strip showing the user's project roles and their assessed skill
 * levels — the "who am I here" line of the dashboard.
 */
export function SkillsStrip() {
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

  const visibleSkills = skills.slice(0, VISIBLE_SKILL_COUNT);
  const hiddenCount = skills.length - visibleSkills.length;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl px-5 py-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-4 w-4 text-app-brand" />
        <span className="text-xs font-semibold tracking-widest text-app-text-muted uppercase">
          Role &amp; skills
        </span>
      </div>

      {roles.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {roles.map((role) => (
            <Badge key={role.id} variant="brand" className="px-2.5 py-1">
              {role.name}
            </Badge>
          ))}
        </div>
      )}

      {visibleSkills.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleSkills.map((skill) => (
            <SkillPill key={skill.id} skill={skill} />
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
