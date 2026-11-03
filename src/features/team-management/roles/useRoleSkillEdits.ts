import { useState } from "react";
import { useToast } from "../../../context/useToast";
import { parseApiError } from "../../../services/apiError";
import { acceptSkillSuggestion, updateRoleSkills } from "../../../services/teamManagementService";
import type { Skill } from "../types";

type Args = {
  roleId: string | null;
  roleSkills: Skill[];
  replaceRoleSkills: (roleId: string, roleSkills: Skill[]) => void;
};

/** Adding a skill to the open role by name, and unlinking one from it. */
export function useRoleSkillEdits({ roleId, roleSkills, replaceRoleSkills }: Args) {
  const toast = useToast();
  const [skillName, setSkillName] = useState("");
  const [addingSkill, setAddingSkill] = useState(false);
  const [removingSkillId, setRemovingSkillId] = useState<string | null>(null);

  async function addSkill() {
    if (!roleId || !skillName.trim() || addingSkill) return;

    setAddingSkill(true);

    try {
      const answered = await acceptSkillSuggestion(roleId, { name: skillName.trim() });

      replaceRoleSkills(roleId, answered);
      setSkillName("");
      toast.success("Skill added");
    } catch (error) {
      toast.error(parseApiError(error, "Couldn't add the skill."));
    } finally {
      setAddingSkill(false);
    }
  }

  /**
   * Unlinks a skill from the open role, without retiring it globally.
   *
   * `updateRoleSkills` replaces the role's complete skill list, so the request carries every
   * skill currently linked to this role minus the one being removed -- including retired ones,
   * which stay linked even though they cannot be picked here. Disabled from the caller
   * when the skill would be left with no role at all, since the backend rejects that with a 400;
   * the `parseApiError` toast is a safety net for a race, not the primary guard.
   */
  async function removeSkill(skill: Skill) {
    if (!roleId || removingSkillId) return;

    const remainingSkillIds = roleSkills
      .filter((candidate) => candidate.id !== skill.id)
      .map((candidate) => candidate.id);

    setRemovingSkillId(skill.id);

    try {
      replaceRoleSkills(roleId, await updateRoleSkills(roleId, remainingSkillIds));
      toast.success("Skill removed from role");
    } catch (error) {
      toast.error(parseApiError(error, "Couldn't remove the skill from this role."));
    } finally {
      setRemovingSkillId(null);
    }
  }

  return { skillName, setSkillName, addingSkill, removingSkillId, addSkill, removeSkill };
}
