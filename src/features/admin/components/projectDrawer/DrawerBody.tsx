import { useId } from "react";
import {
  AlertCircle,
  ChevronRight,
  Copy,
  Database,
  FileText,
  Tag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { DrawerCard } from "../../../../components/ui/DrawerCard";
import { Field } from "../../../../components/ui/Field";
import { Input } from "../../../../components/ui/Input";
import { Spinner } from "../../../../components/ui/Spinner";
import { Textarea } from "../../../../components/ui/Textarea";
import type { AdminUser, ProjectOverview } from "../../types";
import { ProjectPeopleSection } from "../ProjectPeopleSection";
import { SourceList } from "../SourceList";
import type { Derived } from "./drawerRules";
import { ProjectIndustryPanel } from "./projectsKit";
import type { useDrawerActions } from "./useDrawerActions";
import type { ProjectForm } from "./useProjectForm";

type DrawerActions = ReturnType<typeof useDrawerActions>;

type BodyProps = {
  project: ProjectOverview;
  availableUsers: AdminUser[];
  canManageLifecycle: boolean;
  form: ProjectForm;
  derived: Derived;
  actions: DrawerActions;
  isLoading: boolean;
  onUpdateField: (field: "name" | "description", value: string) => void;
  leaveDrawer: (navigate: () => void) => void;
  onOpenSourceDetails?: (projectId: string, sourceId: string) => void;
  onOpenDataIngestion?: (projectId: string) => void;
  onOpenUser?: (userId: string) => void;
};

/** The drawer's content: loading, a failed load, or the cards. */
export function DrawerBody(props: BodyProps) {
  if (props.isLoading) return <LoadingDetails />;
  if (props.form.detailsError) return <LoadFailure message={props.form.detailsError} />;

  return <DrawerCards {...props} />;
}

function LoadingDetails() {
  return (
    <div className="flex min-h-72 items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-app-text-muted">
        <Spinner size="lg" silent />
        <p className="text-sm">Loading project details...</p>
      </div>
    </div>
  );
}

function LoadFailure({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg p-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-app-danger-text">
        <AlertCircle className="h-4 w-4" />
        Project details could not be loaded
      </div>
      <p className="text-sm text-app-danger-text">{message}</p>
    </div>
  );
}

function DrawerCards(props: BodyProps) {
  const { project, form, derived, actions, canManageLifecycle } = props;

  return (
    <div className="space-y-4 sm:space-y-5">
      <DetailsCard {...props} />

      <DrawerCard label="Industry" icon={Tag} index={1}>
        <ProjectIndustryPanel
          projectId={project.id}
          industry={derived.visibleProject.industry}
          industryConfidence={derived.visibleProject.industryConfidence}
          industryCustom={derived.visibleProject.industryCustom}
          canEvaluate={canManageLifecycle}
          canEdit={canManageLifecycle}
          onSave={actions.saveIndustry}
          disabled={actions.isSaving}
          onEvaluated={actions.industryEvaluated}
        />
      </DrawerCard>

      <DrawerCard index={2}>
        <ProjectPeopleSection
          projectId={project.id}
          members={derived.visibleUsers}
          manager={form.projectDetails?.manager ?? null}
          availableUsers={props.availableUsers}
          canAssignManager={canManageLifecycle}
          disabled={actions.isSaving}
          snapshotKey={derived.peopleSnapshotKey}
          draft={derived.activePeopleDraft}
          onDraftChange={form.setPeopleDraft}
          onOpenUser={
            props.onOpenUser
              ? (userId) => props.leaveDrawer(() => props.onOpenUser?.(userId))
              : undefined
          }
        />
      </DrawerCard>

      <SourcesCard {...props} />

      {canManageLifecycle && (
        <DangerZone isSaving={actions.isSaving} onDelete={actions.openDelete} />
      )}
    </div>
  );
}

function DetailsCard({ project, form, actions, onUpdateField }: BodyProps) {
  const nameInputId = useId();
  const descriptionInputId = useId();

  return (
    <DrawerCard label="Details" icon={FileText} index={0}>
      {actions.saveErrorMessage && (
        <div className="mb-5 rounded-2xl border border-app-danger-border bg-app-danger-bg p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-app-danger-text">
            <AlertCircle className="h-4 w-4" />
            Project changes could not be saved
          </div>
          <p className="mt-1 text-sm text-app-danger-text">{actions.saveErrorMessage}</p>
        </div>
      )}

      <div className="space-y-4">
        <Field label="Name" controlId={nameInputId} required disabled={actions.isSaving}>
          <Input
            value={form.draftProject.name}
            onChange={(event) => onUpdateField("name", event.target.value)}
          />
        </Field>

        <Field
          label="Description"
          controlId={descriptionInputId}
          optional
          disabled={actions.isSaving}
        >
          <Textarea
            value={form.draftProject.description}
            onChange={(event) => onUpdateField("description", event.target.value)}
            minRows={4}
            maxRows={12}
            placeholder="No project description yet."
          />
        </Field>

        <ProjectIdRow projectId={project.id} onCopy={actions.copyProjectId} />
      </div>
    </DrawerCard>
  );
}

function ProjectIdRow({ projectId, onCopy }: { projectId: string; onCopy: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-surface-muted py-1 pr-1 pl-4">
      <div className="min-w-0">
        <p className="text-xs text-app-text-muted">Project ID</p>
        <p className="truncate font-mono text-xs text-app-text" title={projectId}>
          {projectId}
        </p>
      </div>

      <Button variant="ghost" size="sm" iconOnly onClick={onCopy} aria-label="Copy project ID">
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SourcesCard({
  project,
  derived,
  leaveDrawer,
  onOpenDataIngestion,
  onOpenSourceDetails,
}: BodyProps) {
  return (
    <DrawerCard
      label="Connected sources"
      icon={Database}
      index={3}
      headerAccessory={
        onOpenDataIngestion ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => leaveDrawer(() => onOpenDataIngestion(project.id))}
            trailingIcon={<ChevronRight className="h-4 w-4" />}
          >
            Open in Data Ingestion
          </Button>
        ) : undefined
      }
    >
      <SourceList
        sources={derived.visibleProject.sources}
        onOpenSourceDetails={
          onOpenSourceDetails
            ? (sourceId) => leaveDrawer(() => onOpenSourceDetails(project.id, sourceId))
            : undefined
        }
      />
    </DrawerCard>
  );
}

function DangerZone({ isSaving, onDelete }: { isSaving: boolean; onDelete: () => void }) {
  return (
    <DrawerCard label="Danger zone" icon={TriangleAlert} variant="danger" index={4}>
      <p className="text-sm text-app-danger-text">
        Deleting a project removes it and all of its user assignments. Connected sources are kept
        and stay available to other projects.
      </p>

      <Button
        variant="dangerSoft"
        onClick={onDelete}
        disabled={isSaving}
        icon={<Trash2 className="h-4 w-4" />}
        className="mt-4"
      >
        Delete project
      </Button>
    </DrawerCard>
  );
}
