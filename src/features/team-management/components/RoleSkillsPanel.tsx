import { Sparkles, X } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import type { Skill, SkillSuggestion } from "../../../services/teamManagementTypes";
import { SkillSuggestionPanel } from "./SkillSuggestionPanel";

type RoleSkillsPanelProps = {
  roleName: string;
  /** Skills of the open role, active first. */
  roleSkills: Skill[];
  skillName: string;
  addingSkill: boolean;
  removingSkillId: string | null;
  /** Only admins and PMs may ask the AI; the endpoint is closed to HR. */
  canSuggest: boolean;
  suggesting: boolean;
  applying: boolean;
  suggestionsOpen: boolean;
  suggestions: SkillSuggestion[];
  selectedSuggestionKeys: Set<string>;
  suggestionError: string | null;
  onSkillNameChange: (name: string) => void;
  onAddSkill: () => void;
  onRemoveSkill: (skill: Skill) => void;
  onSuggest: () => void;
  onToggleSuggestion: (key: string) => void;
  onApplySuggestions: () => void;
  onCloseSuggestions: () => void;
};

/** The skills column of the open role: its chips, the add field and the AI suggestion panel. */
function SkillChip({
  skill,
  removing,
  onRemove,
}: {
  skill: Skill;
  removing: boolean;
  onRemove: (skill: Skill) => void;
}) {
  const retired = skill.status === "RETIRED";

  return (
    <span
      aria-label={skill.name}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
        retired
          ? "border-app-warning-border bg-app-warning-bg text-app-warning-text"
          : "border-app-border bg-app-bg text-app-text"
      }`}
    >
      {skill.name}
      {retired ? (
        <span className="font-medium">Retired</span>
      ) : (
        <button
          type="button"
          aria-label={`Remove ${skill.name} from role`}
          title={
            skill.roleIds.length === 1
              ? "Only role of this skill. An admin can retire it in Access Management."
              : undefined
          }
          disabled={skill.roleIds.length === 1 || removing}
          onClick={() => onRemove(skill)}
          className="text-app-text-muted transition-colors hover:text-app-danger-text disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-app-text-muted"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

type AddSkillFieldProps = Pick<
  RoleSkillsPanelProps,
  "roleName" | "skillName" | "addingSkill" | "onSkillNameChange" | "onAddSkill"
>;

function AddSkillField({
  roleName,
  skillName,
  addingSkill,
  onSkillNameChange,
  onAddSkill,
}: AddSkillFieldProps) {
  return (
    <div className="mt-4 space-y-2">
      <label htmlFor="new-skill-name" className="sr-only">
        Add skill to {roleName}
      </label>
      <Input
        id="new-skill-name"
        value={skillName}
        onChange={(event) => onSkillNameChange(event.target.value)}
        placeholder="Add skill, e.g. React"
      />

      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={onAddSkill}
          disabled={!skillName.trim()}
          loading={addingSkill}
        >
          {addingSkill ? "Adding..." : "Add skill"}
        </Button>
      </div>
    </div>
  );
}

type PanelHeaderProps = Pick<
  RoleSkillsPanelProps,
  "canSuggest" | "suggesting" | "applying" | "suggestionsOpen" | "onSuggest"
>;

function PanelHeader({
  canSuggest,
  suggesting,
  applying,
  suggestionsOpen,
  onSuggest,
}: PanelHeaderProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-app-text">Skills</h4>
        {canSuggest && (
          <Button
            variant="secondary"
            size="sm"
            data-testid="suggest-skills-button"
            loading={suggesting}
            disabled={applying}
            icon={<Sparkles className="h-3.5 w-3.5" />}
            onClick={onSuggest}
          >
            {suggestionsOpen ? "Refresh suggestions" : "Suggest skills"}
          </Button>
        )}
      </div>
      <p className="mt-1 mb-3 text-xs leading-relaxed text-app-text-muted">
        Skills of this role, shown in the skill assessment flow for assigned members.
      </p>
    </>
  );
}

/** The skills column of the open role: its chips, the add field and the AI suggestion panel. */
export function RoleSkillsPanel(props: RoleSkillsPanelProps) {
  const { roleSkills, removingSkillId, onRemoveSkill } = props;

  return (
    <div className="min-w-0 border-t border-app-border pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
      <PanelHeader {...props} />

      <div className="flex flex-wrap gap-2">
        {roleSkills.map((skill) => (
          <SkillChip
            key={skill.id}
            skill={skill}
            removing={removingSkillId === skill.id}
            onRemove={onRemoveSkill}
          />
        ))}

        {roleSkills.length === 0 && (
          <p className="text-xs text-app-text-muted">No skills added yet.</p>
        )}
      </div>
      <AddSkillField {...props} />
      <AnimatePresence initial={false}>
        {props.suggestionsOpen && (
          <SkillSuggestionPanel
            currentSkills={roleSkills}
            suggestions={props.suggestions}
            selectedKeys={props.selectedSuggestionKeys}
            isLoading={props.suggesting}
            isApplying={props.applying}
            errorMessage={props.suggestionError}
            onToggle={props.onToggleSuggestion}
            onApply={props.onApplySuggestions}
            onRetry={props.onSuggest}
            onClose={props.onCloseSuggestions}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
