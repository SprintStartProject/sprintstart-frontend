import { useCallback, useEffect, useState } from "react";
import { getSkills } from "../../../services/teamManagementService";
import { mergeRoleSkills, withoutRole } from "../roleRules";
import type { Skill } from "../../../services/teamManagementTypes";

export type SkillCatalog = {
  skills: Skill[];
  /** Takes in a role's complete skill list as the server returned it. */
  replaceRoleSkills: (roleId: string, roleSkills: Skill[]) => void;
  /** Drops the link to a role that was deleted. */
  forgetRole: (roleId: string) => void;
};

/** The skill catalog, loaded once, and kept in step with what role edits answer. */
export function useSkillCatalog(): SkillCatalog {
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    async function loadSkills() {
      setSkills(await getSkills());
    }

    void loadSkills();
  }, []);

  const replaceRoleSkills = useCallback((roleId: string, roleSkills: Skill[]) => {
    setSkills((current) => mergeRoleSkills(current, roleId, roleSkills));
  }, []);

  const forgetRole = useCallback((roleId: string) => {
    setSkills((current) => withoutRole(current, roleId));
  }, []);

  return { skills, replaceRoleSkills, forgetRole };
}
