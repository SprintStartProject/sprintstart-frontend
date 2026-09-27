import { useId, useState } from "react";
import { BadgeCheck, Check, RotateCcw, ShieldCheck, Trash2, Users } from "lucide-react";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Button } from "../../../components/ui/Button";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { SaveButton } from "../../../components/ui/SaveButton";
import { useToast } from "../../../context/useToast";
import { ApiError } from "../../../services/apiClient";
import { parseApiError } from "../../../services/apiError";
import {
  createSkill,
  deleteSkill,
  updateSkill,
  type CreateSkillRequest,
} from "../../../services/teamManagementService";
import { DrawerCard } from "./DrawerCard";
import { SelectionCheckbox } from "./SelectionCheckbox";
import { StatusChip } from "./StatusChip";
import type { ProjectRole, Skill } from "../types";

type SkillDetailsDrawerProps = {
  /** The skill being edited, or `null` for create mode. */
  skill: Skill | null;
  /** Every skill in the pool, used to tell a genuine create apart from a
   * name collision with a retired skill (the backend reactivates that one
   * instead, and the toast should say so). */
  skills: Skill[];
  roles: ProjectRole[];
  isOpen: boolean;
  onClose: () => void;
  onSkillSaved: (skill: Skill) => void;
};

type SkillDraft = {
  name: string;
  category: string;
  universal: boolean;
  roleIds: string[];
};

function toDraft(skill: Skill | null): SkillDraft {
  if (!skill) return { name: "", category: "", universal: false, roleIds: [] };

  return {
    name: skill.name,
    category: skill.category ?? "",
    universal: skill.universal,
    roleIds: skill.roleIds,
  };
}

function isSameDraft(left: SkillDraft, right: SkillDraft): boolean {
  return (
    left.name === right.name &&
    left.category === right.category &&
    left.universal === right.universal &&
    left.roleIds.length === right.roleIds.length &&
    left.roleIds.every((roleId) => right.roleIds.includes(roleId))
  );
}

function toCreateRequest(draft: SkillDraft, name: string): CreateSkillRequest {
  return {
    name,
    roleIds: draft.roleIds,
    category: draft.category.trim() || null,
    universal: draft.universal,
  };
}

const RETIRE_ASSESSMENTS_NOTE =
  "Existing assessments remain available, but the skill can no longer be assigned or assessed.";

/**
 * Create/edit drawer for one entry in the global skill pool. ADMIN only --
 * every mutation here (`createSkill`, `updateSkill`, `deleteSkill`) 403s for
 * a PM or HR caller.
 *
 * Expects to be remounted per skill via a `key` on the call site (`skill?.id`,
 * or a fixed key for create mode), the same convention `ProjectDetailsDrawer`
 * uses, so the draft below always starts from the right skill.
 */
export function SkillDetailsDrawer({
  skill,
  skills,
  roles,
  isOpen,
  onClose,
  onSkillSaved,
}: SkillDetailsDrawerProps) {
  const toast = useToast();
  const universalCheckboxId = useId();
  const isCreateMode = skill === null;

  const [draft, setDraft] = useState<SkillDraft>(() => toDraft(skill));
  const [nameError, setNameError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRetireDialogOpen, setIsRetireDialogOpen] = useState(false);
  const [isRetiring, setIsRetiring] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  const savedDraft = toDraft(skill);
  const hasChanges = !isCreateMode && !isSameDraft(draft, savedDraft);
  const isBusy = isSaving || isRetiring || isReactivating;

  // Mirrors the backend rule behind `setSkillsForRole`: a skill that is
  // neither universal nor linked to any role would be unreachable from every
  // assessment flow, so the PATCH/POST that would produce that state is
  // rejected before it is even sent.
  const roleValidationError =
    !draft.universal && draft.roleIds.length === 0
      ? "Assign at least one role, or mark this skill as universal."
      : null;

  const updateDraft = (patch: Partial<SkillDraft>) => {
    setNameError("");
    setDraft((current) => ({ ...current, ...patch }));
  };

  const toggleRole = (roleId: string) => {
    updateDraft({
      roleIds: draft.roleIds.includes(roleId)
        ? draft.roleIds.filter((id) => id !== roleId)
        : [...draft.roleIds, roleId],
    });
  };

  const closeDrawer = () => {
    setNameError("");
    onClose();
  };

  const discardChanges = () => {
    setNameError("");
    setDraft(savedDraft);
  };

  const applyConflictOrToast = (error: unknown, fallback: string) => {
    if (error instanceof ApiError && error.status === 409) {
      setNameError(parseApiError(error, "A skill with this name already exists."));
      return;
    }

    toast.error(parseApiError(error, fallback));
  };

  const handleCreate = async () => {
    const trimmedName = draft.name.trim();

    if (!trimmedName) {
      setNameError("Name is required.");
      return;
    }
    if (roleValidationError) return;

    // The response alone can't tell a fresh row apart from a reactivated one
    // -- both come back `ACTIVE` -- so the toast decides from what the pool
    // already held: a matching retired name means the backend reactivated it.
    const reactivatesRetired = skills.some(
      (existing) =>
        existing.status === "RETIRED" &&
        existing.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    setIsSaving(true);
    setNameError("");

    try {
      const created = await createSkill(toCreateRequest(draft, trimmedName));

      onSkillSaved(created);
      toast.success(reactivatesRetired ? "Skill reactivated" : "Skill created");
      closeDrawer();
    } catch (error) {
      applyConflictOrToast(error, "Couldn't create the skill.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!skill) return;

    const trimmedName = draft.name.trim();

    if (!trimmedName) {
      setNameError("Name is required.");
      return;
    }
    if (roleValidationError) return;

    setIsSaving(true);
    setNameError("");

    try {
      const updated = await updateSkill(skill.id, {
        name: trimmedName,
        roleIds: draft.roleIds,
        category: draft.category.trim() || null,
        universal: draft.universal,
      });

      onSkillSaved(updated);
      setDraft(toDraft(updated));
      toast.success("Skill saved");
    } catch (error) {
      applyConflictOrToast(error, "Couldn't save the skill.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetire = async () => {
    if (!skill) return;

    setIsRetiring(true);

    try {
      await deleteSkill(skill.id);

      onSkillSaved({ ...skill, status: "RETIRED" });
      setIsRetireDialogOpen(false);
      toast.success("Skill retired");
    } catch (error) {
      toast.error(parseApiError(error, "Couldn't retire the skill."));
    } finally {
      setIsRetiring(false);
    }
  };

  const handleReactivate = async () => {
    if (!skill) return;
    if (roleValidationError) return;

    setIsReactivating(true);
    setNameError("");

    try {
      // Reactivating matches by the skill's *persisted* name, not whatever is
      // currently typed in the field -- the create endpoint only reactivates
      // a retired row when the name it is given matches one exactly, and a
      // renamed draft would just create an unrelated skill instead.
      const reactivated = await createSkill(toCreateRequest(draft, skill.name));

      onSkillSaved(reactivated);
      setDraft(toDraft(reactivated));
      toast.success("Skill reactivated");
    } catch (error) {
      applyConflictOrToast(error, "Couldn't reactivate the skill.");
    } finally {
      setIsReactivating(false);
    }
  };

  return (
    <>
      <DetailsSideDrawer
        isOpen={isOpen}
        onClose={closeDrawer}
        title={draft.name || (skill ? skill.name : "New skill")}
        closeAriaLabel="Close skill details"
        leading={
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-app-brand-soft text-app-brand">
            <BadgeCheck className="h-6 w-6" />
          </div>
        }
        badge={
          skill ? (
            <StatusChip
              active={skill.status === "ACTIVE"}
              activeLabel="Active"
              inactiveLabel="Retired"
              inactiveVariant="warning"
              inactiveKind="disabled"
            />
          ) : undefined
        }
        footer={
          isCreateMode ? (
            <div className="flex w-full justify-end">
              <Button
                variant="primary"
                onClick={() => void handleCreate()}
                loading={isSaving}
                disabled={Boolean(roleValidationError)}
                icon={<Check className="h-4 w-4" />}
              >
                Create skill
              </Button>
            </div>
          ) : hasChanges ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-app-text">Unsaved changes</p>

              <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
                <Button variant="secondary" onClick={discardChanges} disabled={isBusy}>
                  Discard
                </Button>

                <SaveButton
                  dirty={hasChanges}
                  saving={isSaving}
                  disabled={Boolean(roleValidationError) || isRetiring || isReactivating}
                  onClick={() => void handleSave()}
                />
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4 sm:space-y-5">
          <DrawerCard label="Details" icon={BadgeCheck} index={0}>
            <div className="space-y-4">
              <Field label="Name" error={nameError} disabled={isBusy}>
                <Input
                  value={draft.name}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                  placeholder="e.g. React"
                />
              </Field>

              <Field label="Category" disabled={isBusy}>
                <Input
                  value={draft.category}
                  onChange={(event) => updateDraft({ category: event.target.value })}
                  placeholder="e.g. Engineering"
                />
              </Field>

              <label
                htmlFor={universalCheckboxId}
                className="flex cursor-pointer items-start gap-3"
              >
                <Checkbox
                  id={universalCheckboxId}
                  checked={draft.universal}
                  disabled={isBusy}
                  onChange={(event) => updateDraft({ universal: event.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium text-app-text">Universal</span>
                  <span className="block text-xs text-app-text-muted">
                    Applies to all roles, not just the ones ticked below.
                  </span>
                </span>
              </label>
            </div>
          </DrawerCard>

          <DrawerCard label="Roles" icon={Users} index={1}>
            <ul className="max-h-56 overflow-y-auto rounded-xl border border-app-border">
              {roles.length === 0 ? (
                <li className="px-3 py-4 text-sm text-app-text-muted">No project roles yet.</li>
              ) : (
                roles.map((role) => (
                  <li
                    key={role.id}
                    className="flex items-center gap-3 border-b border-app-border px-3 py-2 last:border-b-0"
                  >
                    <SelectionCheckbox
                      checked={draft.roleIds.includes(role.id)}
                      onChange={() => !isBusy && toggleRole(role.id)}
                      ariaLabel={`Link ${role.name} to this skill`}
                    />
                    <span className="truncate text-sm font-medium text-app-text">{role.name}</span>
                  </li>
                ))
              )}
            </ul>

            {roleValidationError && (
              <p className="mt-2 text-xs font-medium text-app-danger-text" role="alert">
                {roleValidationError}
              </p>
            )}
          </DrawerCard>

          {skill && (
            <DrawerCard label="Status" icon={ShieldCheck} variant="danger" index={2}>
              {skill.status === "ACTIVE" ? (
                <>
                  <p className="text-sm text-app-danger-text">
                    Retiring removes this skill from the assessment flow for every role.{" "}
                    {RETIRE_ASSESSMENTS_NOTE}
                  </p>

                  <Button
                    variant="dangerSoft"
                    onClick={() => setIsRetireDialogOpen(true)}
                    disabled={isBusy}
                    icon={<Trash2 className="h-4 w-4" />}
                    className="mt-4"
                  >
                    Retire skill
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-app-danger-text">
                    Reactivating brings this skill back into the assessment flow, using whatever
                    name, category, roles and universal setting are set above.
                  </p>

                  <Button
                    variant="dangerSoft"
                    onClick={() => void handleReactivate()}
                    loading={isReactivating}
                    disabled={Boolean(roleValidationError) || isSaving}
                    icon={<RotateCcw className="h-4 w-4" />}
                    className="mt-4"
                  >
                    Reactivate
                  </Button>
                </>
              )}
            </DrawerCard>
          )}
        </div>
      </DetailsSideDrawer>

      <AlertDialog
        isOpen={isRetireDialogOpen}
        title="Confirm retirement"
        description={
          <>
            Are you sure you want to retire{" "}
            <span className="font-medium text-app-text">{skill?.name ?? "this skill"}</span>?{" "}
            {RETIRE_ASSESSMENTS_NOTE}
          </>
        }
        confirmLabel="Retire"
        variant="danger"
        isLoading={isRetiring}
        loadingLabel="Retiring..."
        onClose={() => setIsRetireDialogOpen(false)}
        onConfirm={() => void handleRetire()}
      />
    </>
  );
}
