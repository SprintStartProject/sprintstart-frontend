import { useState } from "react";
import { useToast } from "../../../context/useToast";
import { parseApiError } from "../../../services/apiError";
import { acceptSkillSuggestion, createProjectRole } from "../../../services/teamManagementService";
import type { PendingSkill } from "../components/NewRoleSkillsInput";
import type { Skill } from "../types";

/**
 * The picked skills, one after another: each answer is the role's whole skill list, so the last
 * one that worked is the list to show. One that fails does not undo the role or the others; it is
 * named afterwards so it can be added in the panel.
 */
async function addPickedSkills(
  roleId: string,
  picked: PendingSkill[],
): Promise<{ skills: Skill[] | null; failed: string[] }> {
  let skills: Skill[] | null = null;
  const failed: string[] = [];
  for (const pending of picked) {
    try {
      skills = await acceptSkillSuggestion(
        roleId,
        pending.skillId ? { skillId: pending.skillId } : { name: pending.name },
      );
    } catch {
      failed.push(pending.name);
    }
  }
  return { skills, failed };
}

function reportCreated(toast: ReturnType<typeof useToast>, addedCount: number, failed: string[]) {
  toast.success(
    addedCount > 0
      ? `Role created with ${addedCount} ${addedCount === 1 ? "skill" : "skills"}`
      : "Role created",
  );
  if (failed.length > 0) {
    toast.error(`Couldn't add ${failed.join(", ")}. Add it in the role's panel.`);
  }
}

type Args = {
  canSuggest: boolean;
  replaceRoleSkills: (roleId: string, roleSkills: Skill[]) => void;
  onDataChanged: () => Promise<void> | void;
  /** Opens the new role's panel. */
  openRole: (roleId: string) => void;
  /** Asks the AI for skills of the new role. */
  suggestFor: (roleId: string) => Promise<void>;
};

/** The create form: its fields, and creating the role with the skills picked in it. */
export function useRoleCreation({
  canSuggest,
  replaceRoleSkills,
  onDataChanged,
  openRole,
  suggestFor,
}: Args) {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  // Skills picked in the form, added the moment the role exists, and whether the AI is asked for
  // more on top.
  const [pickedSkills, setPickedSkills] = useState<PendingSkill[]>([]);
  const [suggestOnCreate, setSuggestOnCreate] = useState(true);

  async function create() {
    if (!name.trim() || creating) return;

    setCreating(true);

    try {
      const newRole = await createProjectRole(name.trim(), description.trim());
      const added = await addPickedSkills(newRole.id, pickedSkills);
      if (added.skills) replaceRoleSkills(newRole.id, added.skills);
      const failedSkills = added.failed;

      setName("");
      setDescription("");
      setPickedSkills([]);
      setShow(false);
      await onDataChanged();
      openRole(newRole.id);
      reportCreated(toast, pickedSkills.length - failedSkills.length, failedSkills);

      // HR can create roles but the suggest endpoint is ADMIN/PM-only; firing it for HR would 403
      // and show an unrecoverable error in the panel with no button to dismiss it. Not awaited:
      // the AI round-trip should not keep the create button busy once the role already exists
      // and is open -- the panel has its own spinner.
      if (canSuggest && suggestOnCreate) {
        void suggestFor(newRole.id);
      }
    } catch (error) {
      toast.error(parseApiError(error, "Couldn't create the role."));
    } finally {
      setCreating(false);
    }
  }

  return {
    show,
    toggleShow: () => setShow((open) => !open),
    name,
    setName,
    description,
    setDescription,
    pickedSkills,
    setPickedSkills,
    suggestOnCreate,
    setSuggestOnCreate,
    creating,
    create,
  };
}
