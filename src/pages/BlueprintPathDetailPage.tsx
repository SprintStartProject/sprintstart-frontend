import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Archive,
  ArrowLeft,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  FilePlus2,
  History,
  Layers3,
  Link,
  ListChecks,
  Loader2,
  Milestone,
  Minus,
  Plus,
  Rocket,
  RotateCcw,
  Square,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge } from "../components/ui/Badge.tsx";
import { Button } from "../components/ui/Button.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { Field } from "../components/ui/Field.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { Select } from "../components/ui/Select.tsx";
import { Textarea } from "../components/ui/Textarea.tsx";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import type {
  BlueprintOption,
  BlueprintGraphNode,
  BlueprintPhase,
  BlueprintPath,
  BlueprintQuestion,
  BlueprintResource,
  BlueprintStep,
  BlueprintTask,
} from "../features/blueprints/types.ts";
import {
  BlueprintGraphEditor,
  type BlueprintPhaseMetadata,
} from "../features/blueprints/components/BlueprintGraphEditor.tsx";
import { BlueprintSubGraphEditor } from "../features/blueprints/components/BlueprintSubGraphEditor.tsx";
import type {
  BlueprintQuestionMetadata,
  BlueprintStepMetadata,
} from "../features/blueprints/components/BlueprintSubGraphEditor.tsx";
import { blueprintService, type BlueprintScope } from "../services/blueprintService.ts";
import { useProjectContext } from "../features/projects/useProjectContext.ts";
import { useAuth } from "../context/useAuth.ts";

type CreateKind = "phase" | "step" | "task" | "resource" | "question" | "option";
type CreateTarget = {
  kind: CreateKind;
  parentId: string;
  position: number;
  graphPosition?: { graphX: number; graphY: number };
} | null;
type EditTarget =
  | { kind: "task"; item: BlueprintTask }
  | { kind: "resource"; item: BlueprintResource }
  | { kind: "option"; item: BlueprintOption }
  | null;
type SortKind = "phase" | "step" | "task" | "question" | "option";
type RequirementTarget = { phaseId: string } | null;
type RequirementCatalog = {
  skills: { id: string; name: string }[];
  projectRoles: { id: string; name: string }[];
};
type GraphDetail =
  | { kind: "phase"; item: BlueprintPhase }
  | { kind: "step"; item: BlueprintStep }
  | { kind: "question"; item: BlueprintQuestion };

const kindLabels: Record<CreateKind, string> = {
  phase: "phase",
  step: "step",
  task: "task",
  resource: "resource",
  question: "question",
  option: "option",
};

/** Compact definition-list cell used by the graph node detail dialog. */
function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-app-surface-muted p-3">
      <dt className="text-xs font-medium tracking-wide text-app-text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-semibold text-app-text">{value}</dd>
    </div>
  );
}

/** Authors one Blueprint path and its reusable phases, content, and knowledge checks. */
export function BlueprintPathDetailPage() {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { selectedProjectId } = useProjectContext();
  const isGlobal = searchParams.get("scope") === "global" && profile?.permissionGroup === "ADMIN";
  const blueprintScope = useMemo<BlueprintScope>(
    () => (isGlobal ? { kind: "global" } : { kind: "project", projectId: selectedProjectId }),
    [isGlobal, selectedProjectId],
  );
  const blueprintListPath = isGlobal ? "/blueprints?scope=global" : "/blueprints";
  const projectIdAtMount = useRef(selectedProjectId);
  const [path, setPath] = useState<BlueprintPath | null>(null);
  const [subGraphPhaseId, setSubGraphPhaseId] = useState<string | null>(null);
  const [subGraphNodes, setSubGraphNodes] = useState<BlueprintGraphNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<CreateTarget>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [phaseType, setPhaseType] = useState<"FIXED" | "AI_ENHANCED">("FIXED");
  const [aiPrompt, setAiPrompt] = useState("");
  const [url, setUrl] = useState("");
  const [stepType, setStepType] = useState("DOCUMENT");
  const [minutes, setMinutes] = useState("15");
  const [outcome, setOutcome] = useState("");
  const [questionType, setQuestionType] = useState("MULTIPLE_CHOICE");
  const [questionTitle, setQuestionTitle] = useState("");
  const [explanation, setExplanation] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [isCorrect, setIsCorrect] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragged, setDragged] = useState<{ kind: SortKind; id: string } | null>(null);
  const [collapsedPhaseIds, setCollapsedPhaseIds] = useState<Set<string>>(() => new Set());
  const [collapsedStepIds, setCollapsedStepIds] = useState<Set<string>>(() => new Set());
  const [collapsedQuestionIds, setCollapsedQuestionIds] = useState<Set<string>>(() => new Set());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<BlueprintPath[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [addRequirementTarget, setAddRequirementTarget] = useState<RequirementTarget>(null);
  const [removeRequirementTarget, setRemoveRequirementTarget] = useState<RequirementTarget>(null);
  const [requirementType, setRequirementType] = useState<"SKILL" | "PROJECT_ROLE">("SKILL");
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>([]);
  const [requirementCatalog, setRequirementCatalog] = useState<RequirementCatalog | null>(null);
  const [isRequirementCatalogLoading, setIsRequirementCatalogLoading] = useState(false);
  const [isRequirementSaving, setIsRequirementSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<"list" | "graph">("list");
  const [graphDetail, setGraphDetail] = useState<GraphDetail | null>(null);

  const loadPath = useCallback(
    async (showLoading = true) => {
      if (!pathId) return;
      if (showLoading) setIsLoading(true);
      setError(null);
      try {
        setPath(await blueprintService.getPath(blueprintScope, pathId));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Blueprint path could not be loaded.");
      } finally {
        if (showLoading) setIsLoading(false);
      }
    },
    [blueprintScope, pathId],
  );

  useEffect(() => {
    if (!isGlobal && projectIdAtMount.current !== selectedProjectId) {
      projectIdAtMount.current = selectedProjectId;
      void navigate("/blueprints", { replace: true });
      return;
    }
    void loadPath();
  }, [isGlobal, loadPath, navigate, selectedProjectId]);

  async function openHistory() {
    if (!path) return;
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      setHistory(await blueprintService.getHistory(blueprintScope, path.blueprintKey));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Blueprint history could not be loaded.");
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function rollback() {
    if (!path) return;
    try {
      const restored = await blueprintService.rollbackPath(
        blueprintScope,
        path.blueprintKey,
        path.version,
      );
      void navigate(`/blueprints/${restored.id}${isGlobal ? "?scope=global" : ""}`);
      setPath(restored);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Blueprint version could not be restored.",
      );
    }
  }

  async function archivePath() {
    if (!path) return;
    setIsArchiving(true);
    setError(null);
    try {
      await blueprintService.archivePath(blueprintScope, path.blueprintKey);
      void navigate(blueprintListPath);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Blueprint path could not be archived.");
    } finally {
      setIsArchiving(false);
    }
  }

  async function deleteDraft(version: BlueprintPath) {
    setDeletingId(version.id);
    setError(null);
    try {
      await blueprintService.deleteDraft(blueprintScope, version.id);
      setHistory((current) => current.filter((item) => item.id !== version.id));
      if (version.id === pathId) {
        setIsHistoryOpen(false);
        void navigate(blueprintListPath);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Blueprint draft could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  function openCreate(
    kind: CreateKind,
    parentId: string,
    position: number,
    graphPosition?: { graphX: number; graphY: number },
  ) {
    setTitle("");
    setDescription("");
    setPhaseType("FIXED");
    setAiPrompt("");
    setUrl("");
    setStepType("DOCUMENT");
    setMinutes("15");
    setOutcome("");
    setQuestionType("MULTIPLE_CHOICE");
    setQuestionTitle("");
    setExplanation("");
    setCorrectAnswer("");
    setIsCorrect(false);
    setTarget({ kind, parentId, position, graphPosition });
  }

  function openEdit(nextTarget: NonNullable<EditTarget>) {
    setTitle(nextTarget.kind === "option" ? nextTarget.item.label : nextTarget.item.title);
    setDescription(nextTarget.kind === "option" ? "" : nextTarget.item.description);
    setUrl(nextTarget.kind === "resource" ? nextTarget.item.url : "");
    setIsCorrect(nextTarget.kind === "option" && nextTarget.item.correct);
    setEditTarget(nextTarget);
  }

  /** Opens the add overlay and loads its current skill/role choices on demand. */
  async function openAddRequirements(phaseId: string) {
    setAddRequirementTarget({ phaseId });
    setRequirementType("SKILL");
    setSelectedRequirementIds([]);
    setIsRequirementCatalogLoading(true);
    setError(null);
    try {
      setRequirementCatalog(await blueprintService.getRequirementCatalog());
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Requirement choices could not be loaded.",
      );
    } finally {
      setIsRequirementCatalogLoading(false);
    }
  }

  function openRemoveRequirements(phaseId: string) {
    setRemoveRequirementTarget({ phaseId });
    setSelectedRequirementIds([]);
  }

  function toggleRequirementSelection(id: string) {
    setSelectedRequirementIds((current) =>
      current.includes(id) ? current.filter((currentId) => currentId !== id) : [...current, id],
    );
  }

  /** Excludes requirements already attached to the phase from the add overlay. */
  function getAvailableRequirementChoices() {
    const phase = path?.blueprintPhases.find((item) => item.id === addRequirementTarget?.phaseId);
    const existingReferenceIds = new Set(
      (phase?.requirements ?? [])
        .filter((requirement) => requirement.type === requirementType)
        .map((requirement) => requirement.referenceId),
    );
    const choices =
      requirementType === "SKILL"
        ? (requirementCatalog?.skills ?? [])
        : (requirementCatalog?.projectRoles ?? []);

    return choices.filter((choice) => !existingReferenceIds.has(choice.id));
  }

  async function addRequirements(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!path || !addRequirementTarget || selectedRequirementIds.length === 0) return;
    const phase = path.blueprintPhases.find((item) => item.id === addRequirementTarget.phaseId);
    if (!phase) return;

    setIsRequirementSaving(true);
    setError(null);
    try {
      const response = await blueprintService.addPhaseRequirements(
        blueprintScope,
        phase.id,
        phase.revision,
        selectedRequirementIds.map((referenceId) => ({ referenceId, type: requirementType })),
      );
      setPath((current) =>
        current
          ? {
              ...current,
              blueprintPhases: current.blueprintPhases.map((item) =>
                item.id === phase.id
                  ? { ...item, revision: response.revision, requirements: response.requirements }
                  : item,
              ),
            }
          : current,
      );
      setAddRequirementTarget(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The phase requirement could not be added.",
      );
    } finally {
      setIsRequirementSaving(false);
    }
  }

  async function deleteRequirements(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!path || !removeRequirementTarget || selectedRequirementIds.length === 0) return;
    const phase = path.blueprintPhases.find((item) => item.id === removeRequirementTarget.phaseId);
    if (!phase) return;

    setError(null);
    setIsRequirementSaving(true);
    try {
      const selectedRequirements = (phase.requirements ?? []).filter((requirement) =>
        selectedRequirementIds.includes(requirement.id),
      );
      const response = await blueprintService.deletePhaseRequirements(
        blueprintScope,
        phase.id,
        phase.revision,
        selectedRequirements.map(({ id }) => id),
      );
      setPath((current) =>
        current
          ? {
              ...current,
              blueprintPhases: current.blueprintPhases.map((item) =>
                item.id === phase.id
                  ? {
                      ...item,
                      revision: response.revision,
                      requirements: (item.requirements ?? []).filter(
                        (currentRequirement) =>
                          !selectedRequirementIds.includes(currentRequirement.id),
                      ),
                    }
                  : item,
              ),
            }
          : current,
      );
      setRemoveRequirementTarget(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The phase requirement could not be removed.",
      );
    } finally {
      setIsRequirementSaving(false);
    }
  }

  async function createItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target && !editTarget) return;
    setIsSaving(true);
    setError(null);
    try {
      if (editTarget?.kind === "task")
        await blueprintService.updateTask(blueprintScope, editTarget.item.id, {
          revision: editTarget.item.revision,
          position: editTarget.item.position,
          title: questionTitle,
          description,
        });
      if (editTarget?.kind === "option")
        await blueprintService.updateOption(blueprintScope, editTarget.item.id, {
          revision: editTarget.item.revision,
          position: editTarget.item.position,
          label: title,
          correct: isCorrect,
        });
      if (editTarget?.kind === "resource")
        await blueprintService.updateResource(blueprintScope, editTarget.item.id, {
          revision: editTarget.item.revision,
          title,
          description,
          url,
        });
      if (editTarget) {
        setEditTarget(null);
        await refreshActiveEditorData();
        return;
      }
      if (!target) return;
      if (target.kind === "phase") {
        const phase = await blueprintService.createPhase(blueprintScope, target.parentId, {
          position: target.position,
          title,
          description: description || null,
          aiPrompt: phaseType === "AI_ENHANCED" ? aiPrompt : null,
          type: phaseType,
          ...target.graphPosition,
        });
        if (target.graphPosition) {
          setPath((current) =>
            current
              ? { ...current, blueprintPhases: [...current.blueprintPhases, phase] }
              : current,
          );
          setTarget(null);
          return;
        }
      }
      if (target.kind === "step") {
        const step = await blueprintService.createStep(blueprintScope, target.parentId, {
          position: target.position,
          title,
          description,
          type: stepType as "VIDEO" | "DOCUMENT" | "TASK",
          estimatedMinutes: Number(minutes),
          expectedOutcome: outcome,
          ...target.graphPosition,
        });
        if (target.graphPosition) {
          appendCreatedSubGraphStep(step, { revision: step.revision, ...target.graphPosition });
          setTarget(null);
          return;
        }
      }
      if (target.kind === "task")
        await blueprintService.createTask(blueprintScope, target.parentId, {
          position: target.position,
          title,
          description,
        });
      if (target.kind === "resource")
        await blueprintService.createResource(blueprintScope, target.parentId, {
          title,
          description,
          url,
        });
      if (target.kind === "question") {
        const question = await blueprintService.createQuestion(blueprintScope, target.parentId, {
          position: target.position,
          title,
          type: questionType as "MULTIPLE_CHOICE" | "SHORT_TEXT",
          question: title,
          explanation: explanation || null,
          correctAnswer: correctAnswer || null,
          ...target.graphPosition,
        });
        if (target.graphPosition) {
          appendCreatedSubGraphQuestion(question, {
            revision: question.revision,
            ...target.graphPosition,
          });
          setTarget(null);
          return;
        }
      }
      if (target.kind === "option")
        await blueprintService.createOption(blueprintScope, target.parentId, {
          position: target.position,
          label: title,
          correct: isCorrect,
        });
      setTarget(null);
      await refreshActiveEditorData();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : `The ${editTarget?.kind ?? target?.kind ?? "item"} could not be saved.`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  function updateGraphPhase(phaseId: string, update: Partial<BlueprintPhase>) {
    setPath((current) =>
      current
        ? {
            ...current,
            blueprintPhases: current.blueprintPhases.map((phase) =>
              phase.id === phaseId ? { ...phase, ...update } : phase,
            ),
          }
        : current,
    );
  }

  async function saveGraphPosition(phase: BlueprintPhase, graphX: number, graphY: number) {
    const response = await blueprintService.updateGraphNodePosition(blueprintScope, phase.id, {
      revision: phase.revision,
      graphX,
      graphY,
    });
    updateGraphPhase(phase.id, response);
  }

  async function removeGraphNode(phase: BlueprintPhase) {
    const response = await blueprintService.removeGraphNodePosition(
      blueprintScope,
      phase.id,
      phase.revision,
    );
    const revisionsById = new Map(
      response.changedNodes.map((changedNode) => [changedNode.id, changedNode.revision]),
    );
    setPath((current) =>
      current
        ? {
            ...current,
            blueprintPhases: current.blueprintPhases.map((item) => {
              const revision = revisionsById.get(item.id);
              if (revision === undefined) return item;
              return item.id === phase.id
                ? { ...item, revision, graphX: null, graphY: null, blockerIds: [] }
                : {
                    ...item,
                    revision,
                    blockerIds: item.blockerIds.filter((blockerId) => blockerId !== phase.id),
                  };
            }),
          }
        : current,
    );
  }

  async function addGraphBlocker(phase: BlueprintPhase, blockerId: string) {
    const response = await blueprintService.addGraphNodeBlocker(
      blueprintScope,
      phase.id,
      blockerId,
      phase.revision,
    );
    updateGraphPhase(phase.id, response);
  }

  async function removeGraphBlocker(phase: BlueprintPhase, blockerId: string) {
    const response = await blueprintService.removeGraphNodeBlocker(
      blueprintScope,
      phase.id,
      blockerId,
      phase.revision,
    );
    updateGraphPhase(phase.id, response);
  }

  async function updateGraphPhaseMetadata(phase: BlueprintPhase, metadata: BlueprintPhaseMetadata) {
    await blueprintService.updatePhase(blueprintScope, phase.id, {
      revision: phase.revision,
      position: phase.position,
      ...metadata,
    });
    await loadPath();
  }

  /** Refreshes both views so graph-node revisions stay aligned with the detailed authoring DTO. */
  async function refreshSubGraph(phaseId: string | null | undefined) {
    if (!pathId || !phaseId) return;
    const [nextPath, graph] = await Promise.all([
      blueprintService.getPath(blueprintScope, pathId),
      blueprintService.getSubGraph(blueprintScope, phaseId),
    ]);
    setPath(nextPath);
    setSubGraphNodes(graph.nodes);
  }

  /** Keeps an open fixed-phase graph current after mutations from its detail panel. */
  async function refreshActiveEditorData() {
    if (editorMode === "graph" && subGraphPhaseId) {
      await refreshSubGraph(subGraphPhaseId);
      return;
    }
    await loadPath();
  }

  /** Adds a newly created canvas step to both its detailed phase and the thin graph state. */
  function appendCreatedSubGraphStep(
    step: BlueprintStep,
    graphPosition: { revision: number; graphX: number; graphY: number },
  ) {
    const positionedStep = { ...step, ...graphPosition };
    setSubGraphNodes((current) => [
      ...current,
      {
        id: step.id,
        revision: graphPosition.revision,
        title: step.title,
        type: "STEP",
        blueprintPhaseId: step.blueprintPhaseId,
        graphX: graphPosition.graphX,
        graphY: graphPosition.graphY,
        blockerIds: [],
      },
    ]);
    setPath((current) =>
      current
        ? {
            ...current,
            blueprintPhases: current.blueprintPhases.map((phase) =>
              phase.id === step.blueprintPhaseId
                ? { ...phase, blueprintSteps: [...phase.blueprintSteps, positionedStep] }
                : phase,
            ),
          }
        : current,
    );
  }

  /** Adds a newly created canvas knowledge check to both its detailed phase and thin graph state. */
  function appendCreatedSubGraphQuestion(
    question: BlueprintQuestion,
    graphPosition: { revision: number; graphX: number; graphY: number },
  ) {
    const positionedQuestion = { ...question, revision: graphPosition.revision };
    setSubGraphNodes((current) => [
      ...current,
      {
        id: question.id,
        revision: graphPosition.revision,
        title: question.title,
        type: "QUESTION",
        blueprintPhaseId: question.blueprintPhaseId,
        graphX: graphPosition.graphX,
        graphY: graphPosition.graphY,
        blockerIds: [],
      },
    ]);
    setPath((current) =>
      current
        ? {
            ...current,
            blueprintPhases: current.blueprintPhases.map((phase) =>
              phase.id === question.blueprintPhaseId
                ? {
                    ...phase,
                    blueprintCheckQuestions: [...phase.blueprintCheckQuestions, positionedQuestion],
                  }
                : phase,
            ),
          }
        : current,
    );
  }

  async function saveSubGraphPosition(node: BlueprintGraphNode, graphX: number, graphY: number) {
    setSubGraphNodes((current) =>
      current.map((item) => (item.id === node.id ? { ...item, graphX, graphY } : item)),
    );
    let response: { revision: number; graphX: number; graphY: number };
    try {
      response = await blueprintService.updateSubGraphNodePosition(blueprintScope, node.id, {
        revision: node.revision,
        graphX,
        graphY,
      });
    } catch (reason) {
      setSubGraphNodes((current) =>
        current.map((item) =>
          item.id === node.id ? { ...item, graphX: node.graphX, graphY: node.graphY } : item,
        ),
      );
      throw reason;
    }
    const phaseId = node.blueprintPhaseId ?? subGraphPhaseId;
    setSubGraphNodes((current) =>
      current.map((item) => (item.id === node.id ? { ...item, ...response } : item)),
    );
    if (!phaseId) return;
    setPath((current) =>
      current
        ? {
            ...current,
            blueprintPhases: current.blueprintPhases.map((phase) => {
              if (phase.id !== phaseId) return phase;
              return {
                ...phase,
                blueprintSteps: phase.blueprintSteps.map((step) =>
                  step.id === node.id ? { ...step, ...response } : step,
                ),
                blueprintCheckQuestions: phase.blueprintCheckQuestions.map((question) =>
                  question.id === node.id ? { ...question, revision: response.revision } : question,
                ),
              };
            }),
          }
        : current,
    );
  }

  async function removeSubGraphNode(node: BlueprintGraphNode) {
    const response = await blueprintService.removeSubGraphNodePosition(
      blueprintScope,
      node.id,
      node.revision,
    );
    const revisionsById = new Map(
      response.updatedNodes.map((updatedNode) => [updatedNode.id, updatedNode.revision]),
    );
    const phaseId = node.blueprintPhaseId ?? subGraphPhaseId;

    setSubGraphNodes((current) =>
      current.map((item) => {
        const revision = revisionsById.get(item.id);
        if (revision === undefined) return item;
        return item.id === node.id
          ? { ...item, revision, graphX: null, graphY: null, blockerIds: [] }
          : {
              ...item,
              revision,
              blockerIds: item.blockerIds.filter((blockerId) => blockerId !== node.id),
            };
      }),
    );
    if (!phaseId) return;
    setPath((current) =>
      current
        ? {
            ...current,
            blueprintPhases: current.blueprintPhases.map((phase) => {
              if (phase.id !== phaseId) return phase;
              return {
                ...phase,
                blueprintSteps: phase.blueprintSteps.map((step) => {
                  const revision = revisionsById.get(step.id);
                  if (revision === undefined) return step;
                  return step.id === node.id
                    ? { ...step, revision, graphX: null, graphY: null, blockerIds: [] }
                    : {
                        ...step,
                        revision,
                        blockerIds: step.blockerIds.filter((blockerId) => blockerId !== node.id),
                      };
                }),
                blueprintCheckQuestions: phase.blueprintCheckQuestions.map((question) => {
                  const revision = revisionsById.get(question.id);
                  return revision === undefined ? question : { ...question, revision };
                }),
              };
            }),
          }
        : current,
    );
  }

  /** Applies an edge mutation without reloading the whole fixed-phase graph. */
  function updateSubGraphBlockers(
    node: BlueprintGraphNode,
    update: { revision: number; blockerIds: string[] },
  ) {
    const phaseId = node.blueprintPhaseId ?? subGraphPhaseId;
    setSubGraphNodes((current) =>
      current.map((item) => (item.id === node.id ? { ...item, ...update } : item)),
    );
    if (!phaseId) return;
    setPath((current) =>
      current
        ? {
            ...current,
            blueprintPhases: current.blueprintPhases.map((phase) => {
              if (phase.id !== phaseId) return phase;
              return {
                ...phase,
                blueprintSteps: phase.blueprintSteps.map((step) =>
                  step.id === node.id ? { ...step, ...update } : step,
                ),
                blueprintCheckQuestions: phase.blueprintCheckQuestions.map((question) =>
                  question.id === node.id ? { ...question, revision: update.revision } : question,
                ),
              };
            }),
          }
        : current,
    );
  }

  async function addSubGraphBlocker(node: BlueprintGraphNode, blockerId: string) {
    const response = await blueprintService.addSubGraphNodeBlocker(
      blueprintScope,
      node.id,
      blockerId,
      node.revision,
    );
    updateSubGraphBlockers(node, response);
  }

  async function removeSubGraphBlocker(node: BlueprintGraphNode, blockerId: string) {
    const response = await blueprintService.removeSubGraphNodeBlocker(
      blueprintScope,
      node.id,
      blockerId,
      node.revision,
    );
    updateSubGraphBlockers(node, response);
  }

  async function updateSubGraphQuestion(
    question: BlueprintQuestion,
    metadata: BlueprintQuestionMetadata,
  ) {
    await blueprintService.updateQuestion(blueprintScope, question.id, {
      revision: question.revision,
      position: question.position,
      ...metadata,
    });
    await refreshSubGraph(question.blueprintPhaseId);
  }

  async function addSubGraphQuestionOption(
    question: BlueprintQuestion,
    label: string,
    correct: boolean,
  ) {
    await blueprintService.createOption(blueprintScope, question.id, {
      position: question.blueprintCheckOptions.length,
      label,
      correct,
    });
    await refreshSubGraph(question.blueprintPhaseId);
  }

  async function removeSubGraphQuestionOption(option: BlueprintOption) {
    await blueprintService.deleteOption(blueprintScope, option.id, option.revision);
    if (subGraphPhaseId) await refreshSubGraph(subGraphPhaseId);
    else await loadPath();
  }

  async function updateSubGraphStep(step: BlueprintStep, metadata: BlueprintStepMetadata) {
    await blueprintService.updateStep(blueprintScope, step.id, {
      revision: step.revision,
      position: step.position,
      ...metadata,
    });
    await refreshSubGraph(step.blueprintPhaseId);
  }

  async function openSubGraph(phase: BlueprintPhase) {
    if (phase.type === "AI_ENHANCED") return;
    setError(null);
    try {
      const graph = await blueprintService.getSubGraph(blueprintScope, phase.id);
      setSubGraphNodes(graph.nodes);
      setSubGraphPhaseId(phase.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Phase graph could not be loaded.");
    }
  }

  /** Reloads top-level graph positions, which are not refreshed by subgraph mutations. */
  async function returnToTopLevelGraph() {
    if (!path) return;
    setError(null);
    setSubGraphPhaseId(null);
    setSubGraphNodes([]);
    try {
      const graph = await blueprintService.getGraph(blueprintScope, path.id);
      const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
      setPath((current) =>
        current
          ? {
              ...current,
              blueprintPhases: current.blueprintPhases.map((phase) => {
                const node = nodesById.get(phase.id);
                return node
                  ? {
                      ...phase,
                      revision: node.revision,
                      graphX: node.graphX,
                      graphY: node.graphY,
                      blockerIds: node.blockerIds,
                    }
                  : phase;
              }),
            }
          : current,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Blueprint graph could not be loaded.");
    }
  }

  async function openGraphEditor() {
    if (!path) return;
    setError(null);
    try {
      const activeSubGraphPhase = subGraphPhaseId
        ? path.blueprintPhases.find((phase) => phase.id === subGraphPhaseId)
        : null;
      if (activeSubGraphPhase?.type === "FIXED") {
        const graph = await blueprintService.getSubGraph(blueprintScope, activeSubGraphPhase.id);
        setSubGraphNodes(graph.nodes);
        setEditorMode("graph");
        return;
      }
      const graph = await blueprintService.getGraph(blueprintScope, path.id);
      const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
      setPath((current) =>
        current
          ? {
              ...current,
              blueprintPhases: current.blueprintPhases.map((phase) => {
                const node = nodesById.get(phase.id);
                return node
                  ? {
                      ...phase,
                      revision: node.revision,
                      graphX: node.graphX,
                      graphY: node.graphY,
                      blockerIds: node.blockerIds,
                    }
                  : phase;
              }),
            }
          : current,
      );
      if (subGraphPhaseId) {
        setSubGraphPhaseId(null);
        setSubGraphNodes([]);
      }
      setEditorMode("graph");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Blueprint graph could not be loaded.");
    }
  }

  /**
   * Applies the graph-side effects reported by a phase deletion. The response also contains the
   * deleted phase itself; filtering it out first intentionally makes that entry a no-op.
   */
  function applyPhaseDeletion(phaseId: string, updatedPhases: { id: string; revision: number }[]) {
    const revisionsById = new Map(updatedPhases.map((phase) => [phase.id, phase.revision]));
    setPath((current) =>
      current
        ? {
            ...current,
            blueprintPhases: current.blueprintPhases
              .filter((phase) => phase.id !== phaseId)
              .map((phase) => {
                const revision = revisionsById.get(phase.id);
                return revision === undefined
                  ? phase
                  : {
                      ...phase,
                      revision,
                      blockerIds: phase.blockerIds.filter((blockerId) => blockerId !== phaseId),
                    };
              }),
          }
        : current,
    );
  }

  /**
   * Applies the graph-side effects reported by a step deletion. The deleted step may appear in
   * updatedSteps, but it is removed before revisions are applied.
   */
  function applyStepDeletion(stepId: string, updatedSteps: { id: string; revision: number }[]) {
    const revisionsById = new Map(updatedSteps.map((step) => [step.id, step.revision]));
    setSubGraphNodes((current) =>
      current
        .filter((node) => node.id !== stepId)
        .map((node) => {
          const revision = revisionsById.get(node.id);
          return revision === undefined
            ? node
            : {
                ...node,
                revision,
                blockerIds: node.blockerIds.filter((blockerId) => blockerId !== stepId),
              };
        }),
    );
    setPath((current) =>
      current
        ? {
            ...current,
            blueprintPhases: current.blueprintPhases.map((phase) => ({
              ...phase,
              blueprintSteps: phase.blueprintSteps
                .filter((step) => step.id !== stepId)
                .map((step) => {
                  const revision = revisionsById.get(step.id);
                  return revision === undefined
                    ? step
                    : {
                        ...step,
                        revision,
                        blockerIds: step.blockerIds.filter((blockerId) => blockerId !== stepId),
                      };
                }),
              blueprintCheckQuestions: phase.blueprintCheckQuestions.map((question) => {
                const revision = revisionsById.get(question.id);
                return revision === undefined ? question : { ...question, revision };
              }),
            })),
          }
        : current,
    );
  }

  /**
   * Applies the graph-side effects reported by a question deletion. The deleted question may
   * appear in updatedQuestions, but it is removed before revisions are applied.
   */
  function applyQuestionDeletion(
    questionId: string,
    updatedQuestions: { id: string; revision: number }[],
  ) {
    const revisionsById = new Map(
      updatedQuestions.map((question) => [question.id, question.revision]),
    );
    setSubGraphNodes((current) =>
      current
        .filter((node) => node.id !== questionId)
        .map((node) => {
          const revision = revisionsById.get(node.id);
          return revision === undefined
            ? node
            : {
                ...node,
                revision,
                blockerIds: node.blockerIds.filter((blockerId) => blockerId !== questionId),
              };
        }),
    );
    setPath((current) =>
      current
        ? {
            ...current,
            blueprintPhases: current.blueprintPhases.map((phase) => ({
              ...phase,
              blueprintSteps: phase.blueprintSteps.map((step) => {
                const revision = revisionsById.get(step.id);
                return revision === undefined
                  ? step
                  : {
                      ...step,
                      revision,
                      blockerIds: step.blockerIds.filter((blockerId) => blockerId !== questionId),
                    };
              }),
              blueprintCheckQuestions: phase.blueprintCheckQuestions
                .filter((question) => question.id !== questionId)
                .map((question) => {
                  const revision = revisionsById.get(question.id);
                  return revision === undefined ? question : { ...question, revision };
                }),
            })),
          }
        : current,
    );
  }

  async function deleteItem(
    kind: "phase" | "step" | "question" | "task" | "resource" | "option",
    id: string,
  ) {
    setDeletingId(id);
    setError(null);
    try {
      const phase = path?.blueprintPhases.find((item) => item.id === id);
      const step = path?.blueprintPhases
        .flatMap((item) => item.blueprintSteps)
        .find((item) => item.id === id);
      const question = path?.blueprintPhases
        .flatMap((item) => item.blueprintCheckQuestions)
        .find((item) => item.id === id);
      const task = path?.blueprintPhases
        .flatMap((item) => item.blueprintSteps)
        .flatMap((item) => item.blueprintTasks)
        .find((item) => item.id === id);
      const resource = path?.blueprintPhases
        .flatMap((item) => item.blueprintSteps)
        .flatMap((item) => item.blueprintResources)
        .find((item) => item.id === id);
      const option = path?.blueprintPhases
        .flatMap((item) => item.blueprintCheckQuestions)
        .flatMap((item) => item.blueprintCheckOptions)
        .find((item) => item.id === id);
      if (kind === "phase" && phase) {
        const response = await blueprintService.deletePhase(blueprintScope, id, phase.revision);
        applyPhaseDeletion(id, response.updatedPhases);
      } else if (kind === "step" && step) {
        const response = await blueprintService.deleteStep(blueprintScope, id, step.revision);
        applyStepDeletion(id, response.updatedSteps);
      } else if (kind === "question" && question) {
        const response = await blueprintService.deleteQuestion(
          blueprintScope,
          id,
          question.revision,
        );
        applyQuestionDeletion(id, response.updatedQuestions);
      } else if (kind === "task" && task)
        await blueprintService.deleteTask(blueprintScope, id, task.revision);
      else if (kind === "resource" && resource)
        await blueprintService.deleteResource(blueprintScope, id, resource.revision);
      else if (kind === "option" && option)
        await blueprintService.deleteOption(blueprintScope, id, option.revision);
      else throw new Error(`The ${kind} could not be found.`);
      if (kind !== "phase" && kind !== "step" && kind !== "question")
        await refreshActiveEditorData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `The ${kind} could not be deleted.`);
    } finally {
      setDeletingId(null);
    }
  }

  async function reorder(kind: SortKind, id: string, position: number) {
    if (!path) return;
    const phases = path.blueprintPhases;
    const phase = phases.find((item) => item.id === id);
    const step = phases.flatMap((item) => item.blueprintSteps).find((item) => item.id === id);
    const task = phases
      .flatMap((item) => item.blueprintSteps)
      .flatMap((item) => item.blueprintTasks)
      .find((item) => item.id === id);
    const question = phases
      .flatMap((item) => item.blueprintCheckQuestions)
      .find((item) => item.id === id);
    const option = phases
      .flatMap((item) => item.blueprintCheckQuestions)
      .flatMap((item) => item.blueprintCheckOptions)
      .find((item) => item.id === id);
    setPath((current) => {
      if (!current) return current;
      const move = <T extends { id: string; position: number }>(items: T[]) => {
        const sourceIndex = items.findIndex((item) => item.id === id);
        if (sourceIndex < 0) return items;
        const reordered = [...items];
        const [moved] = reordered.splice(sourceIndex, 1);
        reordered.splice(position, 0, moved);
        return reordered.map((item, index) => ({ ...item, position: index }));
      };
      if (kind === "phase") return { ...current, blueprintPhases: move(current.blueprintPhases) };
      return {
        ...current,
        blueprintPhases: current.blueprintPhases.map((currentPhase) => ({
          ...currentPhase,
          blueprintSteps:
            kind === "step" && currentPhase.blueprintSteps.some((item) => item.id === id)
              ? move(currentPhase.blueprintSteps)
              : currentPhase.blueprintSteps.map((currentStep) => ({
                  ...currentStep,
                  blueprintTasks:
                    kind === "task" && currentStep.blueprintTasks.some((item) => item.id === id)
                      ? move(currentStep.blueprintTasks)
                      : currentStep.blueprintTasks,
                })),
          blueprintCheckQuestions:
            kind === "question" &&
            currentPhase.blueprintCheckQuestions.some((item) => item.id === id)
              ? move(currentPhase.blueprintCheckQuestions)
              : currentPhase.blueprintCheckQuestions.map((currentQuestion) => ({
                  ...currentQuestion,
                  blueprintCheckOptions:
                    kind === "option" &&
                    currentQuestion.blueprintCheckOptions.some((item) => item.id === id)
                      ? move(currentQuestion.blueprintCheckOptions)
                      : currentQuestion.blueprintCheckOptions,
                })),
        })),
      };
    });
    try {
      let updates: { id: string; revision: number; position: number }[] = [];
      if (kind === "phase" && phase)
        updates = await blueprintService.updatePhasePosition(blueprintScope, id, {
          revision: phase.revision,
          position,
        });
      if (kind === "step" && step)
        updates = await blueprintService.updateStepPosition(blueprintScope, id, {
          revision: step.revision,
          position,
        });
      if (kind === "task" && task)
        updates = await blueprintService.updateTaskPosition(blueprintScope, id, {
          revision: task.revision,
          position,
        });
      if (kind === "question" && question)
        updates = await blueprintService.updateQuestionPosition(blueprintScope, id, {
          revision: question.revision,
          position,
        });
      if (kind === "option" && option)
        updates = await blueprintService.updateOptionPosition(blueprintScope, id, {
          revision: option.revision,
          position,
        });
      setPath((current) => {
        if (!current) return current;
        const applyUpdates = <T extends { id: string; revision: number; position: number }>(
          items: T[],
        ) => {
          const byId = new Map(updates.map((update) => [update.id, update]));
          return items.map((item) => {
            const update = byId.get(item.id);
            return update
              ? { ...item, revision: update.revision, position: update.position }
              : item;
          });
        };
        if (kind === "phase")
          return { ...current, blueprintPhases: applyUpdates(current.blueprintPhases) };
        return {
          ...current,
          blueprintPhases: current.blueprintPhases.map((currentPhase) => ({
            ...currentPhase,
            blueprintSteps:
              kind === "step" && currentPhase.blueprintSteps.some((item) => item.id === id)
                ? applyUpdates(currentPhase.blueprintSteps)
                : currentPhase.blueprintSteps.map((currentStep) => ({
                    ...currentStep,
                    blueprintTasks:
                      kind === "task" && currentStep.blueprintTasks.some((item) => item.id === id)
                        ? applyUpdates(currentStep.blueprintTasks)
                        : currentStep.blueprintTasks,
                  })),
            blueprintCheckQuestions:
              kind === "question" &&
              currentPhase.blueprintCheckQuestions.some((item) => item.id === id)
                ? applyUpdates(currentPhase.blueprintCheckQuestions)
                : currentPhase.blueprintCheckQuestions.map((currentQuestion) => ({
                    ...currentQuestion,
                    blueprintCheckOptions:
                      kind === "option" &&
                      currentQuestion.blueprintCheckOptions.some((item) => item.id === id)
                        ? applyUpdates(currentQuestion.blueprintCheckOptions)
                        : currentQuestion.blueprintCheckOptions,
                  })),
          })),
        };
      });
    } catch (reason) {
      setPath(path);
      setError(reason instanceof Error ? reason.message : "The item could not be reordered.");
    }
  }

  function dragProps(kind: SortKind, id: string, position: number) {
    return {
      draggable: true,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        setDragged({ kind, id });
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (dragged?.kind === kind && dragged.id !== id) void reorder(kind, dragged.id, position);
        setDragged(null);
      },
      onDragEnd: () => setDragged(null),
    };
  }

  function togglePhaseCollapsed(phaseId: string) {
    setCollapsedPhaseIds((current) => {
      const next = new Set(current);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }

  function toggleStepCollapsed(stepId: string) {
    setCollapsedStepIds((current) => {
      const next = new Set(current);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }

  function toggleQuestionCollapsed(questionId: string) {
    setCollapsedQuestionIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  // Keep the existing shell visible during a graph → list refresh. This avoids replacing the
  // whole page with a loading state while the nested DTO catches up with graph revisions.
  if (isLoading && !path)
    return (
      <main className="flex min-h-80 items-center justify-center gap-3 text-app-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading blueprint…
      </main>
    );
  if (!path)
    return (
      <main className="mx-auto max-w-3xl p-8">
        <Button
          variant="secondary"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => void navigate(blueprintListPath)}
        >
          Back to blueprints
        </Button>
        <p role="alert" className="mt-6 text-app-danger-text">
          {error || "Blueprint path not found."}
        </p>
      </main>
    );

  const subGraphPhase = subGraphPhaseId
    ? (path.blueprintPhases.find((phase) => phase.id === subGraphPhaseId) ?? null)
    : null;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={Layers3}
        title={path.title}
        subtitle={path.description || "No path description yet."}
        actions={
          <>
            <Badge variant={path.status === "ACTIVE" ? "success" : "warning"}>
              {path.status} · v{path.version}
            </Badge>
            <Button
              variant="secondary"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => void navigate(blueprintListPath)}
            >
              All blueprints
            </Button>
            <Button
              variant="secondary"
              icon={<History className="h-4 w-4" />}
              onClick={() => void openHistory()}
            >
              Version history
            </Button>
            {path.status === "ACTIVE" ? (
              <>
                <Button
                  variant="dangerSoft"
                  icon={<Archive className="h-4 w-4" />}
                  loading={isArchiving}
                  onClick={() => void archivePath()}
                >
                  Archive
                </Button>
                <Button
                  variant="primary"
                  icon={<FilePlus2 className="h-4 w-4" />}
                  onClick={() =>
                    void blueprintService
                      .openDraft(blueprintScope, path.blueprintKey)
                      .then((draft) =>
                        navigate(`/blueprints/${draft.id}${isGlobal ? "?scope=global" : ""}`),
                      )
                      .catch((reason: unknown) =>
                        setError(
                          reason instanceof Error ? reason.message : "Draft could not be opened.",
                        ),
                      )
                  }
                >
                  Edit as draft
                </Button>
              </>
            ) : path.status === "ARCHIVED" ? (
              <Button
                variant="primary"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={() => void rollback()}
              >
                Revert to this version
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={<Rocket className="h-4 w-4" />}
                onClick={() =>
                  void blueprintService
                    .publishPath(blueprintScope, path.id)
                    .then(setPath)
                    .catch((reason: unknown) =>
                      setError(
                        reason instanceof Error
                          ? reason.message
                          : "Blueprint could not be published.",
                      ),
                    )
                }
              >
                Publish
              </Button>
            )}
          </>
        }
      />
      {error ? (
        <p role="alert" className="rounded-xl bg-app-danger-bg p-4 text-sm text-app-danger-text">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2" aria-label="Blueprint editor mode">
        <Button
          size="sm"
          variant={editorMode === "list" ? "primary" : "secondary"}
          aria-pressed={editorMode === "list"}
          icon={<ListChecks className="h-4 w-4" />}
          onClick={() => {
            setEditorMode("list");
            // The graph endpoints update node revisions independently from the nested path DTO.
            // Reload it before exposing list mutations so their optimistic-lock revisions are current.
            void loadPath();
          }}
        >
          List editor
        </Button>
        <Button
          size="sm"
          variant={editorMode === "graph" ? "primary" : "secondary"}
          aria-pressed={editorMode === "graph"}
          icon={<Link className="h-4 w-4" />}
          onClick={() => void openGraphEditor()}
        >
          Graph editor
        </Button>
      </div>
      {editorMode === "graph" ? (
        subGraphPhase ? (
          <BlueprintSubGraphEditor
            phase={subGraphPhase}
            nodes={subGraphNodes}
            editable={path.status === "DRAFT"}
            onBack={() => void returnToTopLevelGraph()}
            onPositionChange={saveSubGraphPosition}
            onRemoveNode={removeSubGraphNode}
            onAddBlocker={addSubGraphBlocker}
            onRemoveBlocker={removeSubGraphBlocker}
            onCreateFromLibrary={(kind, graphX, graphY) => {
              openCreate(
                kind,
                subGraphPhase.id,
                kind === "step"
                  ? subGraphPhase.blueprintSteps.length
                  : subGraphPhase.blueprintCheckQuestions.length,
                { graphX, graphY },
              );
              return Promise.resolve();
            }}
            onUpdateQuestion={updateSubGraphQuestion}
            onAddOption={addSubGraphQuestionOption}
            onRemoveOption={removeSubGraphQuestionOption}
            onUpdateStep={updateSubGraphStep}
            onAddTask={(step) => openCreate("task", step.id, step.blueprintTasks.length)}
            onRemoveTask={(task) => void deleteItem("task", task.id)}
            onAddResource={(step) =>
              openCreate("resource", step.id, step.blueprintResources.length)
            }
            onRemoveResource={(resource) => void deleteItem("resource", resource.id)}
            onEditTask={(task) => openEdit({ kind: "task", item: task })}
            onEditResource={(resource) => openEdit({ kind: "resource", item: resource })}
            onEditOption={(option) => openEdit({ kind: "option", item: option })}
            onDeleteStep={(step) => deleteItem("step", step.id)}
            onDeleteQuestion={(question) => deleteItem("question", question.id)}
          />
        ) : (
          <BlueprintGraphEditor
            phases={path.blueprintPhases}
            pathTitle={path.title}
            editable={path.status === "DRAFT"}
            onPositionChange={saveGraphPosition}
            onRemoveNode={removeGraphNode}
            onAddBlocker={addGraphBlocker}
            onRemoveBlocker={removeGraphBlocker}
            onCreateFromLibrary={(graphX, graphY) => {
              openCreate("phase", path.id, path.blueprintPhases.length, { graphX, graphY });
              return Promise.resolve();
            }}
            onDeletePhase={(phase) => deleteItem("phase", phase.id)}
            onOpenSubGraph={(phase) => void openSubGraph(phase)}
            onUpdatePhase={updateGraphPhaseMetadata}
          />
        )
      ) : (
        <section className="space-y-5">
          {path.blueprintPhases.length === 0 ? (
            <EmptyState
              icon={<Milestone className="h-8 w-8" />}
              title="No phases yet"
              action={
                <Button
                  variant="primary"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => openCreate("phase", path.id, 0)}
                >
                  Add phase
                </Button>
              }
            >
              Build the path in phases, then add steps and a knowledge check to each phase.
            </EmptyState>
          ) : (
            path.blueprintPhases
              .sort((a, b) => a.position - b.position)
              .map((phase, phaseIndex) => (
                <section
                  key={phase.id}
                  {...dragProps("phase", phase.id, phaseIndex)}
                  className="rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2">
                      <Button
                        aria-label={`${collapsedPhaseIds.has(phase.id) ? "Expand" : "Collapse"} phase ${phase.title}`}
                        aria-expanded={!collapsedPhaseIds.has(phase.id)}
                        iconOnly
                        size="sm"
                        variant="ghost"
                        onClick={() => togglePhaseCollapsed(phase.id)}
                      >
                        {collapsedPhaseIds.has(phase.id) ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <div className="min-w-0">
                        {!collapsedPhaseIds.has(phase.id) ? (
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold tracking-wide text-app-brand-text uppercase">
                              Phase {phase.position + 1}
                            </p>
                            <Badge variant={phase.type === "AI_ENHANCED" ? "warning" : "neutral"}>
                              {phase.type === "AI_ENHANCED" ? "AI-enhanced" : "Fixed"}
                            </Badge>
                          </div>
                        ) : null}
                        <h2 className="mt-1 text-xl font-semibold text-app-text">{phase.title}</h2>
                        <p className="mt-1 text-sm text-app-text-muted">
                          {phase.description || "No phase description."}
                        </p>
                        {!collapsedPhaseIds.has(phase.id) &&
                        phase.type === "AI_ENHANCED" &&
                        phase.aiPrompt ? (
                          <div className="mt-3 rounded-xl border border-app-warning-border bg-app-warning-bg p-3 text-sm">
                            <p className="font-medium text-app-warning-text">AI prompt</p>
                            <p className="mt-1 whitespace-pre-wrap text-app-text-muted">
                              {phase.aiPrompt}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {!collapsedPhaseIds.has(phase.id) ? (
                      <Button
                        aria-label={`Delete phase ${phase.title}`}
                        iconOnly
                        size="sm"
                        variant="dangerGhost"
                        loading={deletingId === phase.id}
                        onClick={() => void deleteItem("phase", phase.id)}
                      >
                        <Minus className="h-4 w-4" strokeWidth={2.5} />
                      </Button>
                    ) : null}
                  </div>
                  {!collapsedPhaseIds.has(phase.id) ? (
                    <>
                      <div className="mt-5 rounded-xl border border-app-border bg-app-surface-muted p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-app-text">Phase requirements</h3>
                            <p className="mt-1 text-sm text-app-text-muted">
                              Skills or project roles required before this phase unlocks.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Plus className="h-3.5 w-3.5" />}
                              onClick={() => void openAddRequirements(phase.id)}
                            >
                              Add requirements
                            </Button>
                            <Button
                              size="sm"
                              variant="dangerSoft"
                              icon={<Minus className="h-3.5 w-3.5" />}
                              disabled={(phase.requirements ?? []).length === 0}
                              onClick={() => openRemoveRequirements(phase.id)}
                            >
                              Remove requirements
                            </Button>
                          </div>
                        </div>
                        {(phase.requirements ?? []).length === 0 ? (
                          <p className="mt-3 text-sm text-app-text-subtle">No requirements yet.</p>
                        ) : (
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {(phase.requirements ?? []).map((requirement) => (
                              <li
                                key={requirement.id}
                                className="flex items-center gap-1 rounded-lg border border-app-border bg-app-surface px-2 py-1 text-sm text-app-text"
                              >
                                <span className="text-xs text-app-text-subtle">
                                  {requirement.type === "SKILL" ? "Skill:" : "Role:"}
                                </span>
                                <span>{requirement.displayName}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {phase.type === "FIXED" ? (
                        <div className="mt-5 grid gap-4 lg:grid-cols-2">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="flex items-center gap-2 font-semibold text-app-text">
                                <ListChecks className="h-4 w-4 text-app-brand-text" /> Steps
                              </h3>
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<Plus className="h-3.5 w-3.5" />}
                                onClick={() =>
                                  openCreate("step", phase.id, phase.blueprintSteps.length)
                                }
                              >
                                Add step
                              </Button>
                            </div>
                            {phase.blueprintSteps.length === 0 ? (
                              <EmptyState size="sm">No steps in this phase.</EmptyState>
                            ) : (
                              phase.blueprintSteps
                                .sort((a, b) => a.position - b.position)
                                .map((step, stepIndex) => (
                                  <article
                                    key={step.id}
                                    {...dragProps("step", step.id, stepIndex)}
                                    className="rounded-xl border border-app-border bg-app-surface p-4 shadow-sm"
                                  >
                                    <div className="flex items-start gap-2">
                                      <Button
                                        aria-label={`${collapsedStepIds.has(step.id) ? "Expand" : "Collapse"} step ${step.title}`}
                                        aria-expanded={!collapsedStepIds.has(step.id)}
                                        iconOnly
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => toggleStepCollapsed(step.id)}
                                      >
                                        {collapsedStepIds.has(step.id) ? (
                                          <ChevronRight className="h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4" />
                                        )}
                                      </Button>
                                      <div className="min-w-0">
                                        <h4 className="font-medium text-app-text">
                                          {step.position + 1}. {step.title}
                                        </h4>
                                        <p className="mt-1 text-sm text-app-text-muted">
                                          {step.description}
                                        </p>
                                        {!collapsedStepIds.has(step.id) ? (
                                          <p className="mt-2 text-xs text-app-text-subtle">
                                            {step.type} · {step.estimatedMinutes} min ·{" "}
                                            {step.expectedOutcome}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                    {!collapsedStepIds.has(step.id) ? (
                                      <>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            icon={<Plus className="h-3.5 w-3.5" />}
                                            onClick={() =>
                                              openCreate(
                                                "task",
                                                step.id,
                                                step.blueprintTasks.length,
                                              )
                                            }
                                          >
                                            Add task
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            icon={<Plus className="h-3.5 w-3.5" />}
                                            onClick={() => openCreate("resource", step.id, 0)}
                                          >
                                            Add resource
                                          </Button>
                                        </div>
                                        {step.blueprintTasks.length > 0 ? (
                                          <div className="mt-3">
                                            <p className="mb-1 text-xs font-semibold tracking-wide text-app-text-subtle uppercase">
                                              Tasks
                                            </p>
                                            <ul className="space-y-1 text-sm text-app-text-muted">
                                              {step.blueprintTasks.map((task, taskIndex) => (
                                                <li
                                                  key={task.id}
                                                  {...dragProps("task", task.id, taskIndex)}
                                                  className="flex items-center gap-2 rounded-lg border border-app-border-muted bg-app-surface-muted p-1"
                                                >
                                                  <div
                                                    role="button"
                                                    tabIndex={0}
                                                    className="min-w-0 flex-1 cursor-pointer px-2 py-1 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                                                    onClick={() =>
                                                      openEdit({ kind: "task", item: task })
                                                    }
                                                    onKeyDown={(event) => {
                                                      if (
                                                        event.key === "Enter" ||
                                                        event.key === " "
                                                      ) {
                                                        event.preventDefault();
                                                        openEdit({ kind: "task", item: task });
                                                      }
                                                    }}
                                                  >
                                                    • {task.title}
                                                  </div>
                                                  <Button
                                                    aria-label={`Delete task ${task.title}`}
                                                    iconOnly
                                                    size="sm"
                                                    variant="dangerGhost"
                                                    loading={deletingId === task.id}
                                                    onClick={() => void deleteItem("task", task.id)}
                                                  >
                                                    <Minus className="h-4 w-4" strokeWidth={2.5} />
                                                  </Button>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        ) : null}
                                        {step.blueprintResources.length > 0 ? (
                                          <div className="mt-3">
                                            <p className="mb-1 text-xs font-semibold tracking-wide text-app-text-subtle uppercase">
                                              Resources
                                            </p>
                                            <ul className="space-y-1 text-sm text-app-text-muted">
                                              {step.blueprintResources.map((resource) => (
                                                <li
                                                  key={resource.id}
                                                  className="flex items-center gap-2 rounded-lg border border-app-border-muted bg-app-surface-muted p-1"
                                                >
                                                  <div
                                                    role="button"
                                                    tabIndex={0}
                                                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                                                    onClick={() =>
                                                      openEdit({ kind: "resource", item: resource })
                                                    }
                                                    onKeyDown={(event) => {
                                                      if (
                                                        event.key === "Enter" ||
                                                        event.key === " "
                                                      ) {
                                                        event.preventDefault();
                                                        openEdit({
                                                          kind: "resource",
                                                          item: resource,
                                                        });
                                                      }
                                                    }}
                                                  >
                                                    <Link className="h-3.5 w-3.5 shrink-0" />
                                                    {resource.title}
                                                  </div>
                                                  <Button
                                                    aria-label={`Delete resource ${resource.title}`}
                                                    iconOnly
                                                    size="sm"
                                                    variant="dangerGhost"
                                                    loading={deletingId === resource.id}
                                                    onClick={() =>
                                                      void deleteItem("resource", resource.id)
                                                    }
                                                  >
                                                    <Minus className="h-4 w-4" strokeWidth={2.5} />
                                                  </Button>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        ) : null}
                                      </>
                                    ) : null}
                                  </article>
                                ))
                            )}
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="flex items-center gap-2 font-semibold text-app-text">
                                <BookOpenCheck className="h-4 w-4 text-app-brand-text" /> Knowledge
                                check
                              </h3>
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<Plus className="h-3.5 w-3.5" />}
                                onClick={() =>
                                  openCreate(
                                    "question",
                                    phase.id,
                                    phase.blueprintCheckQuestions.length,
                                  )
                                }
                              >
                                Add question
                              </Button>
                            </div>
                            {phase.blueprintCheckQuestions.length === 0 ? (
                              <EmptyState size="sm">No questions in this phase.</EmptyState>
                            ) : (
                              phase.blueprintCheckQuestions
                                .sort((a, b) => a.position - b.position)
                                .map((question, questionIndex) => (
                                  <article
                                    key={question.id}
                                    {...dragProps("question", question.id, questionIndex)}
                                    className="rounded-xl border border-app-border bg-app-surface p-4 shadow-sm"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex min-w-0 items-start gap-2">
                                        <Button
                                          aria-label={`${collapsedQuestionIds.has(question.id) ? "Expand" : "Collapse"} question ${question.question}`}
                                          aria-expanded={!collapsedQuestionIds.has(question.id)}
                                          iconOnly
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => toggleQuestionCollapsed(question.id)}
                                        >
                                          {collapsedQuestionIds.has(question.id) ? (
                                            <ChevronRight className="h-4 w-4" />
                                          ) : (
                                            <ChevronDown className="h-4 w-4" />
                                          )}
                                        </Button>
                                        <div className="min-w-0">
                                          {!collapsedQuestionIds.has(question.id) ? (
                                            <p className="text-xs text-app-text-subtle">
                                              {question.type.replace("_", " ")}
                                            </p>
                                          ) : null}
                                          <h4 className="mt-1 font-medium text-app-text">
                                            {question.position + 1}. {question.question}
                                          </h4>
                                          {question.explanation ? (
                                            <p className="mt-1 text-sm text-app-text-muted">
                                              {question.explanation}
                                            </p>
                                          ) : null}
                                        </div>
                                      </div>
                                      {question.type === "MULTIPLE_CHOICE" &&
                                      !collapsedQuestionIds.has(question.id) ? (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          icon={<Plus className="h-3.5 w-3.5" />}
                                          onClick={() =>
                                            openCreate(
                                              "option",
                                              question.id,
                                              question.blueprintCheckOptions.length,
                                            )
                                          }
                                        >
                                          Add option
                                        </Button>
                                      ) : null}
                                    </div>
                                    {!collapsedQuestionIds.has(question.id) &&
                                    question.blueprintCheckOptions.length > 0 ? (
                                      <ul className="mt-3 space-y-1 text-sm text-app-text-muted">
                                        {question.blueprintCheckOptions.map(
                                          (option, optionIndex) => (
                                            <li
                                              key={option.id}
                                              {...dragProps("option", option.id, optionIndex)}
                                              className="flex items-center gap-2 rounded-lg border border-app-border-muted bg-app-surface-muted p-1"
                                            >
                                              <div
                                                role="button"
                                                tabIndex={0}
                                                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                                                onClick={() =>
                                                  openEdit({ kind: "option", item: option })
                                                }
                                                onKeyDown={(event) => {
                                                  if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    openEdit({ kind: "option", item: option });
                                                  }
                                                }}
                                              >
                                                {option.correct ? (
                                                  <CircleCheckBig className="h-4 w-4 text-app-success-text" />
                                                ) : (
                                                  <Square className="h-4 w-4" />
                                                )}
                                                {option.label}
                                              </div>
                                              <Button
                                                aria-label={`Delete option ${option.label}`}
                                                iconOnly
                                                size="sm"
                                                variant="dangerGhost"
                                                loading={deletingId === option.id}
                                                onClick={() => void deleteItem("option", option.id)}
                                              >
                                                <Minus className="h-4 w-4" strokeWidth={2.5} />
                                              </Button>
                                            </li>
                                          ),
                                        )}
                                      </ul>
                                    ) : null}
                                  </article>
                                ))
                            )}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </section>
              ))
          )}
          {path.blueprintPhases.length > 0 ? (
            <Button
              variant="secondary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => openCreate("phase", path.id, path.blueprintPhases.length)}
            >
              Add phase
            </Button>
          ) : null}
        </section>
      )}
      <Modal
        isOpen={graphDetail !== null}
        title={graphDetail?.item.title ?? "Blueprint details"}
        onClose={() => setGraphDetail(null)}
        size="lg"
      >
        {graphDetail?.kind === "phase" ? (
          <div className="space-y-6 text-sm">
            <div>
              <h3 className="font-semibold text-app-text">Description</h3>
              <p className="mt-1 text-app-text-muted">
                {graphDetail.item.description || "No description yet."}
              </p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              <DetailStat label="Phase type" value={graphDetail.item.type} />
              <DetailStat label="Steps" value={String(graphDetail.item.blueprintSteps.length)} />
              <DetailStat
                label="Knowledge-check questions"
                value={String(graphDetail.item.blueprintCheckQuestions.length)}
              />
            </dl>
            {graphDetail.item.aiPrompt ? (
              <div>
                <h3 className="font-semibold text-app-text">AI prompt</h3>
                <p className="mt-1 whitespace-pre-wrap text-app-text-muted">
                  {graphDetail.item.aiPrompt}
                </p>
              </div>
            ) : null}
            <div>
              <h3 className="font-semibold text-app-text">Requirements</h3>
              {graphDetail.item.requirements?.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {graphDetail.item.requirements.map((requirement) => (
                    <li key={requirement.id}>
                      <Badge variant="neutral">
                        {requirement.type === "SKILL" ? "Skill" : "Project role"}:{" "}
                        {requirement.displayName}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-app-text-muted">No requirements configured.</p>
              )}
            </div>
          </div>
        ) : graphDetail?.kind === "step" ? (
          <div className="space-y-5 text-sm">
            <p className="text-app-text-muted">{graphDetail.item.description}</p>
            <dl className="grid gap-4 sm:grid-cols-3">
              <DetailStat label="Step type" value={graphDetail.item.type} />
              <DetailStat
                label="Estimated time"
                value={`${graphDetail.item.estimatedMinutes} min`}
              />
              <DetailStat label="AI assisted" value={graphDetail.item.aiAssisted ? "Yes" : "No"} />
            </dl>
            <div>
              <h3 className="font-semibold text-app-text">Expected outcome</h3>
              <p className="mt-1 text-app-text-muted">{graphDetail.item.expectedOutcome}</p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailStat label="Tasks" value={String(graphDetail.item.blueprintTasks.length)} />
              <DetailStat
                label="Resources"
                value={String(graphDetail.item.blueprintResources.length)}
              />
            </dl>
          </div>
        ) : graphDetail?.kind === "question" ? (
          <div className="space-y-5 text-sm">
            <DetailStat label="Question type" value={graphDetail.item.type} />
            <div>
              <h3 className="font-semibold text-app-text">Question</h3>
              <p className="mt-1 text-app-text-muted">{graphDetail.item.question}</p>
            </div>
            {graphDetail.item.explanation ? (
              <div>
                <h3 className="font-semibold text-app-text">Explanation</h3>
                <p className="mt-1 text-app-text-muted">{graphDetail.item.explanation}</p>
              </div>
            ) : null}
            <DetailStat
              label="Answer options"
              value={String(graphDetail.item.blueprintCheckOptions.length)}
            />
          </div>
        ) : null}
      </Modal>
      <Modal
        isOpen={addRequirementTarget !== null}
        title="Add phase requirements"
        description="Select skills or project roles that must be met before this phase unlocks."
        onClose={() => setAddRequirementTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddRequirementTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="add-phase-requirements"
              loading={isRequirementSaving}
              disabled={selectedRequirementIds.length === 0 || isRequirementCatalogLoading}
            >
              Add selected
            </Button>
          </>
        }
      >
        {isRequirementCatalogLoading ? (
          <div className="flex items-center gap-3 py-8 text-app-text-muted">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading requirement choices…
          </div>
        ) : (
          <form
            id="add-phase-requirements"
            className="space-y-4"
            onSubmit={(event) => void addRequirements(event)}
          >
            <Field label="Requirement type">
              <Select
                value={requirementType}
                onChange={(event) => {
                  setRequirementType(event.target.value as "SKILL" | "PROJECT_ROLE");
                  setSelectedRequirementIds([]);
                }}
              >
                <option value="SKILL">Skill</option>
                <option value="PROJECT_ROLE">Project role</option>
              </Select>
            </Field>
            <fieldset>
              <legend className="text-sm font-medium text-app-text">
                {requirementType === "SKILL" ? "Skills" : "Project roles"}
              </legend>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-xl border border-app-border bg-app-surface p-2">
                {getAvailableRequirementChoices().map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-app-text hover:bg-app-surface-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRequirementIds.includes(item.id)}
                      onChange={() => toggleRequirementSelection(item.id)}
                      className="h-4 w-4 accent-[var(--color-app-brand)]"
                    />
                    {item.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </form>
        )}
      </Modal>
      <Modal
        isOpen={removeRequirementTarget !== null}
        title="Remove phase requirements"
        description="Select every requirement to remove from this phase."
        onClose={() => setRemoveRequirementTarget(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoveRequirementTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="dangerSoft"
              type="submit"
              form="remove-phase-requirements"
              loading={isRequirementSaving}
              disabled={selectedRequirementIds.length === 0}
            >
              Remove selected
            </Button>
          </>
        }
      >
        <form
          id="remove-phase-requirements"
          className="space-y-2"
          onSubmit={(event) => void deleteRequirements(event)}
        >
          {(
            path.blueprintPhases.find((phase) => phase.id === removeRequirementTarget?.phaseId)
              ?.requirements ?? []
          ).map((requirement) => (
            <label
              key={requirement.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text hover:bg-app-surface-muted"
            >
              <input
                type="checkbox"
                checked={selectedRequirementIds.includes(requirement.id)}
                onChange={() => toggleRequirementSelection(requirement.id)}
                className="h-4 w-4 accent-[var(--color-app-danger)]"
              />
              <span className="text-app-text-subtle">
                {requirement.type === "SKILL" ? "Skill" : "Project role"}
              </span>
              <span>{requirement.displayName}</span>
            </label>
          ))}
        </form>
      </Modal>
      <Modal
        isOpen={isHistoryOpen}
        title="Version history"
        description="Select a version to inspect or restore it."
        onClose={() => setIsHistoryOpen(false)}
        size="lg"
      >
        {isHistoryLoading ? (
          <div className="flex items-center gap-3 py-8 text-app-text-muted">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading versions…
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((version) => {
              const badge = (
                <Badge
                  variant={
                    version.status === "ACTIVE"
                      ? "success"
                      : version.status === "ARCHIVED"
                        ? "neutral"
                        : "warning"
                  }
                >
                  {version.status}
                </Badge>
              );

              return (
                <article
                  key={version.id}
                  className="flex items-center gap-2 rounded-xl border border-app-border bg-app-surface p-1"
                >
                  <Button
                    variant="ghost"
                    fullWidth
                    className="h-auto min-w-0 flex-1 justify-between px-3 py-2 text-left"
                    onClick={() => {
                      setIsHistoryOpen(false);
                      void navigate(`/blueprints/${version.id}${isGlobal ? "?scope=global" : ""}`);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">Version {version.version}</span>
                      <span className="mt-1 block truncate text-xs text-app-text-muted">
                        {version.description || "No description"}
                      </span>
                    </span>
                    {badge}
                  </Button>
                  {version.status === "DRAFT" ? (
                    <Button
                      aria-label={`Delete draft version ${version.version}`}
                      iconOnly
                      variant="dangerGhost"
                      loading={deletingId === version.id}
                      onClick={() => void deleteDraft(version)}
                    >
                      <Minus className="h-4 w-4" strokeWidth={2.5} />
                    </Button>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </Modal>
      <Modal
        isOpen={target !== null || editTarget !== null}
        zIndexClassName="z-[60]"
        title={
          editTarget
            ? `Edit ${editTarget.kind}`
            : `Add ${target ? kindLabels[target.kind] : "item"}`
        }
        description="This is reusable blueprint content, not a change to an active onboarding path."
        onClose={() => {
          setTarget(null);
          setEditTarget(null);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setTarget(null);
                setEditTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="create-blueprint-item" loading={isSaving}>
              {editTarget ? "Save changes" : `Add ${target ? kindLabels[target.kind] : "item"}`}
            </Button>
          </>
        }
      >
        <form
          id="create-blueprint-item"
          className="space-y-4"
          onSubmit={(event) => void createItem(event)}
        >
          {target?.kind === "question" ? (
            <>
              <Field label="Node title" required>
                <Input
                  value={questionTitle}
                  onChange={(event) => setQuestionTitle(event.target.value)}
                  required
                />
              </Field>
              <Field label="Question" required>
                <Textarea
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </Field>
            </>
          ) : (
            <Field label="Title or label" required>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </Field>
          )}
          {(target !== null && target.kind !== "option" && target.kind !== "question") ||
          editTarget?.kind === "task" ||
          editTarget?.kind === "resource" ? (
            <Field label="Description" required={target?.kind !== "phase"}>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required={target?.kind !== "phase"}
              />
            </Field>
          ) : null}
          {target?.kind === "phase" ? (
            <>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-app-border bg-app-surface-muted p-3">
                <div>
                  <p className="text-sm font-medium text-app-text">Phase type</p>
                  <p className="text-xs text-app-text-muted">
                    {phaseType === "FIXED" ? "Fixed blueprint" : "AI-enhanced blueprint"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label="Use AI prompt for this phase"
                  aria-checked={phaseType === "AI_ENHANCED"}
                  onClick={() =>
                    setPhaseType((current) => (current === "FIXED" ? "AI_ENHANCED" : "FIXED"))
                  }
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${
                    phaseType === "AI_ENHANCED"
                      ? "border-app-brand bg-app-brand"
                      : "border-app-border-strong bg-app-neutral-bg"
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      phaseType === "AI_ENHANCED" ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {phaseType === "AI_ENHANCED" ? (
                <Field label="AI prompt" required>
                  <Textarea
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="Describe how AI should tailor this phase."
                    required
                  />
                </Field>
              ) : null}
            </>
          ) : null}
          {target?.kind === "resource" || editTarget?.kind === "resource" ? (
            <Field label="URL" required>
              <Input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
              />
            </Field>
          ) : null}
          {target?.kind === "step" ? (
            <>
              <Field label="Step type">
                <Select value={stepType} onChange={(event) => setStepType(event.target.value)}>
                  <option value="VIDEO">Video</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="TASK">Task</option>
                </Select>
              </Field>
              <Field label="Estimated minutes" required>
                <Input
                  type="number"
                  min="1"
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  required
                />
              </Field>
              <Field label="Expected outcome" required>
                <Textarea
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value)}
                  required
                />
              </Field>
            </>
          ) : null}
          {target?.kind === "question" ? (
            <>
              <Field label="Question type">
                <Select
                  value={questionType}
                  onChange={(event) => setQuestionType(event.target.value)}
                >
                  <option value="MULTIPLE_CHOICE">Multiple choice</option>
                  <option value="SHORT_TEXT">Short text</option>
                </Select>
              </Field>
              <Field label="Explanation">
                <Textarea
                  value={explanation}
                  onChange={(event) => setExplanation(event.target.value)}
                />
              </Field>
              <Field label="Correct answer (for free text)">
                <Input
                  value={correctAnswer}
                  onChange={(event) => setCorrectAnswer(event.target.value)}
                />
              </Field>
            </>
          ) : null}
          {target?.kind === "option" || editTarget?.kind === "option" ? (
            <label className="flex items-center gap-2 text-sm text-app-text">
              <input
                type="checkbox"
                checked={isCorrect}
                onChange={(event) => setIsCorrect(event.target.checked)}
              />{" "}
              Correct answer
            </label>
          ) : null}
        </form>
      </Modal>
    </main>
  );
}
