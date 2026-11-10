import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "../../../components/ui/Button";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import type { Skill } from "../../../services/teamManagementTypes";
import { NewRoleSkillsInput, type PendingSkill } from "./NewRoleSkillsInput";

type CreateRoleFormProps = {
  name: string;
  description: string;
  /** The skill catalog, offered while picking. */
  catalog: Skill[];
  pickedSkills: PendingSkill[];
  suggestOnCreate: boolean;
  /** Only admins and PMs may ask the AI; the endpoint is closed to HR. */
  canSuggest: boolean;
  creating: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onPickedSkillsChange: (skills: PendingSkill[]) => void;
  onSuggestOnCreateChange: (suggest: boolean) => void;
  onCreate: () => void;
};

function FormHeading() {
  return (
    <div className="flex items-start gap-3 px-4 pt-4">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm"
      >
        <Plus className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-app-text">New role</h4>
        <p className="text-xs text-app-text-muted">
          Name it, say what it is for and pick its skills — members can be given it right after.
        </p>
      </div>
    </div>
  );
}

type NameFieldProps = Pick<CreateRoleFormProps, "name" | "onNameChange">;

function NameField({ name, onNameChange }: NameFieldProps) {
  // Opening the form puts the cursor in its first field, so "New role" is one press to typing.
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  return (
    <div>
      <label htmlFor="new-role-name" className="mb-1 block text-xs font-medium text-app-text-muted">
        Name
      </label>
      <Input
        ref={nameRef}
        id="new-role-name"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="e.g. Backend"
      />
    </div>
  );
}

type DescriptionFieldProps = Pick<CreateRoleFormProps, "description" | "onDescriptionChange">;

function DescriptionField({ description, onDescriptionChange }: DescriptionFieldProps) {
  return (
    <div>
      <label
        htmlFor="new-role-description"
        className="mb-1 block text-xs font-medium text-app-text-muted"
      >
        Description
      </label>
      <Textarea
        id="new-role-description"
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        minRows={1}
        maxRows={6}
        placeholder="What this role is responsible for"
      />
    </div>
  );
}

type SuggestOptionProps = Pick<
  CreateRoleFormProps,
  "canSuggest" | "suggestOnCreate" | "onSuggestOnCreateChange"
>;

function SuggestOption({
  canSuggest,
  suggestOnCreate,
  onSuggestOnCreateChange,
}: SuggestOptionProps) {
  if (!canSuggest) {
    return (
      <p className="text-xs text-app-text-muted">The role opens right away to assign members.</p>
    );
  }

  return (
    <label
      htmlFor="new-role-suggest"
      className="flex cursor-pointer items-center gap-2 text-xs text-app-text-muted"
    >
      <Checkbox
        id="new-role-suggest"
        checked={suggestOnCreate}
        onChange={(event) => onSuggestOnCreateChange(event.target.checked)}
      />
      Also suggest skills with AI — to review once the role is open
    </label>
  );
}

/**
 * The new role's form, a card of its own above the list rather than its first row, so it stands
 * apart from the roles already there — tinted, framed in the brand colour, with a heading of its
 * own, so it reads as the thing to fill in now.
 */
export function CreateRoleForm(props: CreateRoleFormProps) {
  const { name, creating, pickedSkills, catalog, onPickedSkillsChange, onCreate } = props;

  return (
    <div className="mt-3 rounded-2xl border border-app-brand-border-strong bg-app-brand-soft/60 shadow-md ring-1 ring-app-brand/20">
      <FormHeading />
      <div className="grid gap-3 p-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-start">
        <NameField name={name} onNameChange={props.onNameChange} />
        <DescriptionField
          description={props.description}
          onDescriptionChange={props.onDescriptionChange}
        />
        <div className="sm:col-span-2">
          <NewRoleSkillsInput
            catalog={catalog}
            value={pickedSkills}
            onChange={onPickedSkillsChange}
            disabled={creating}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <SuggestOption
            canSuggest={props.canSuggest}
            suggestOnCreate={props.suggestOnCreate}
            onSuggestOnCreateChange={props.onSuggestOnCreateChange}
          />
          <Button
            variant="primary"
            onClick={onCreate}
            disabled={!name.trim()}
            loading={creating}
            icon={<Plus className="h-4 w-4" />}
          >
            {creating ? "Creating role…" : "Create role"}
          </Button>
        </div>
      </div>
    </div>
  );
}
