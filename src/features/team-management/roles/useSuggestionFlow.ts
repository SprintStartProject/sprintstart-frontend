import { useState, type RefObject } from "react";
import { useToast } from "../../../context/useToast";
import { parseApiError } from "../../../services/apiError";
import { acceptSkillSuggestion, getSkillsByRoleId } from "../../../services/teamManagementService";
import { useProjectContext } from "../pmKit";
import { skillSuggestionKey } from "../skillSuggestion";
import { suggestionsToApply, uniqueSuggestions } from "../roleRules";
import { useRoleSkillSuggestions } from "../useRoleSkillSuggestions";
import type { Skill, SkillSuggestion } from "../types";

type Args = {
  /**
   * Mirrors the open role, but as a ref rather than state: a request or an apply still in flight
   * when the user switches (or closes) roles reads this after awaiting, to tell whether its
   * result is still meant for the role that is open by the time it arrives. State read through
   * the async function's closure would only ever see the value from when the request started.
   */
  openRoleIdRef: RefObject<string | null>;
  roleSkills: Skill[];
  replaceRoleSkills: (roleId: string, roleSkills: Skill[]) => void;
};

/** What the suggestion panel shows: whether it is open, the list, the ticks and an error. */
function useSuggestionPanel() {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SkillSuggestion[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function clearList() {
    setSuggestions([]);
    setSelectedKeys(new Set());
  }

  return {
    open,
    suggestions,
    selectedKeys,
    error,
    setError,
    close: () => setOpen(false),
    reset: () => {
      setOpen(false);
      setError(null);
      clearList();
    },
    startLoading: () => {
      setOpen(true);
      setError(null);
      clearList();
    },
    show: (list: SkillSuggestion[]) => {
      setSuggestions(list);
      setSelectedKeys(new Set(list.map(skillSuggestionKey)));
    },
    toggle: (key: string) => {
      setSelectedKeys((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
  };
}

/** Accepts the suggestions one after another; the last answer is the role's whole skill list. */
async function acceptAll(
  roleId: string,
  accepted: SkillSuggestion[],
  from: Skill[],
): Promise<Skill[]> {
  let answered = from;

  for (const suggestion of accepted) {
    answered = await acceptSkillSuggestion(
      roleId,
      suggestion.skillId
        ? { skillId: suggestion.skillId }
        : { name: suggestion.name, category: suggestion.category },
    );
  }

  return answered;
}

/** Reads the role's skills back after a half-done apply; a refresh failure must not hide the error. */
async function refreshRoleSkills(
  roleId: string,
  replaceRoleSkills: (roleId: string, roleSkills: Skill[]) => void,
) {
  try {
    replaceRoleSkills(roleId, await getSkillsByRoleId(roleId));
  } catch {
    // The original apply error is the actionable one.
  }
}

type ProjectContext = ReturnType<typeof useProjectContext>;

/** The project the AI should suggest for, with its industry when it has one. */
function suggestionContext(
  hasProject: boolean,
  projectId: ProjectContext["selectedProjectId"],
  project: ProjectContext["selectedProject"],
) {
  if (!hasProject) return undefined;

  return { projectId, ...(project?.industry ? { industry: project.industry } : {}) };
}

/** The AI skill suggestions of the open role: asking, reviewing, and applying the ticked ones. */
export function useSuggestionFlow({ openRoleIdRef, roleSkills, replaceRoleSkills }: Args) {
  const toast = useToast();
  const { selectedProjectId, selectedProject, hasSelectedProject } = useProjectContext();
  const { isSuggesting, suggest } = useRoleSkillSuggestions();
  const panel = useSuggestionPanel();
  const [applying, setApplying] = useState(false);

  async function request(roleId: string) {
    panel.startLoading();

    const context = suggestionContext(hasSelectedProject, selectedProjectId, selectedProject);
    const result = await suggest(roleId, context);

    // The user may have closed this role or opened another one while the request was in flight;
    // a late answer must not overwrite whatever that other role's panel is showing (or apply
    // itself to the wrong role once "Apply" is pressed).
    if (openRoleIdRef.current !== roleId) return;

    if (result.ok) panel.show(uniqueSuggestions(result.suggestions));
    else panel.setError(result.message);
  }

  async function apply(roleId: string) {
    if (applying) return;

    const accepted = suggestionsToApply(panel.suggestions, panel.selectedKeys, roleSkills);

    if (accepted.length === 0) return;

    setApplying(true);
    panel.setError(null);

    try {
      replaceRoleSkills(roleId, await acceptAll(roleId, accepted, roleSkills));

      // Closing/reopening onto another role while this ran must not suddenly hide *that* role's
      // panel or wipe its own suggestions; only touch the shared panel state if this role is
      // still the one open.
      if (openRoleIdRef.current === roleId) panel.reset();

      toast.success(
        accepted.length === 1
          ? "1 suggested skill added"
          : `${accepted.length} suggested skills added`,
      );
    } catch (failure) {
      await refreshRoleSkills(roleId, replaceRoleSkills);

      if (openRoleIdRef.current === roleId) {
        panel.setError(
          parseApiError(
            failure,
            "Some suggestions may have been added. Review the role skills and try again.",
          ),
        );
      }
    } finally {
      setApplying(false);
    }
  }

  return {
    isSuggesting,
    open: panel.open,
    suggestions: panel.suggestions,
    selectedKeys: panel.selectedKeys,
    error: panel.error,
    applying,
    request,
    toggle: panel.toggle,
    apply,
    reset: panel.reset,
    close: panel.close,
  };
}
