import type { ProjectManager } from "../../../../services/projectService";
import type { AdminUser } from "../../types";
import {
  AddSourceFlow,
  removeDraftSource,
  setDraftSourceOwner,
  type useSourceDraftForm,
} from "./addSourceKit";
import { WizardDetailsStep } from "./steps/WizardDetailsStep";
import { WizardMembersStep } from "./steps/WizardMembersStep";
import { WizardProvisioning } from "./steps/WizardProvisioning";
import { WizardReviewStep, type ReviewPerson } from "./steps/WizardReviewStep";
import { WizardSourcesStep } from "./steps/WizardSourcesStep";
import type { WizardDraft } from "./useWizardDraft";
import type { WizardPhase } from "./wizardRules";

type AddForm = ReturnType<typeof useSourceDraftForm>;

type WizardBodyProps = {
  phase: WizardPhase;
  draft: WizardDraft;
  users: AdminUser[];
  tokenNames: string[];
  nameError: string;
  trimmedName: string;
  managers: { candidates: ProjectManager[]; isLoading: boolean; error: string };
  addForm: AddForm;
  ownerOptions: { value: string; label: string }[];
  review: { manager: ReviewPerson | null; members: ReviewPerson[] };
  memberCount: number;
  isSubmitting: boolean;
  onSubmitDetails: () => void;
  onGoToPhase: (phase: WizardPhase) => void;
  onCommitAddSource: () => void;
  onRetry: (sourceId: string) => void;
};

function SourcesPhase(props: WizardBodyProps) {
  const { draft, addForm } = props;

  if (addForm.isOpen) {
    return (
      <AddSourceFlow
        key={addForm.flowKey}
        step={addForm.step}
        selectedType={addForm.type}
        onSelectType={addForm.selectType}
        onBack={addForm.backToTypes}
        context={{ projectId: null, tokenNames: props.tokenNames }}
        onDraftsChange={addForm.reportDrafts}
        onSubmit={props.onCommitAddSource}
        onCompanionOpenChange={addForm.setCompanionOpen}
      />
    );
  }

  return (
    <WizardSourcesStep
      sources={draft.sources}
      onRemove={(sourceId) => draft.setSources((current) => removeDraftSource(current, sourceId))}
      ownerOptions={props.ownerOptions}
      onOwnerChange={(sourceId, ownerUserId) =>
        draft.setSources((current) => setDraftSourceOwner(current, sourceId, ownerUserId))
      }
      onAddSource={addForm.open}
    />
  );
}

function DetailsPhase(props: WizardBodyProps) {
  const { draft, managers } = props;

  return (
    <WizardDetailsStep
      name={draft.name}
      nameError={props.nameError}
      description={draft.description}
      industry={draft.industry}
      managerId={draft.managerId}
      managerCandidates={managers.candidates}
      isLoadingCandidates={managers.isLoading}
      candidatesError={managers.error}
      onNameChange={draft.changeName}
      onNameBlur={() => draft.setNameTouched(true)}
      onDescriptionChange={draft.setDescription}
      onIndustryChange={draft.setIndustry}
      onManagerChange={draft.setManagerId}
      onSubmit={props.onSubmitDetails}
    />
  );
}

function ReviewPhase(props: WizardBodyProps) {
  const { draft } = props;

  return (
    <WizardReviewStep
      name={draft.name}
      description={draft.description}
      industry={draft.industry}
      manager={props.review.manager}
      members={props.review.members}
      sources={draft.sources}
      onEditDetails={() => props.onGoToPhase("details")}
      onEditMembers={() => props.onGoToPhase("members")}
      onEditSources={() => props.onGoToPhase("sources")}
    />
  );
}

/** The screen for the current phase. */
export function WizardBody(props: WizardBodyProps) {
  const { phase, draft } = props;

  switch (phase) {
    case "details":
      return <DetailsPhase {...props} />;
    case "members":
      return (
        <WizardMembersStep
          users={props.users}
          selectedUserIds={draft.selectedUserIds}
          managerId={draft.managerId}
          onChange={draft.setSelectedUserIds}
          onManagerRemoved={() => draft.setManagerId("")}
        />
      );
    case "sources":
      return <SourcesPhase {...props} />;
    case "review":
      return <ReviewPhase {...props} />;
    case "provisioning":
      return (
        <WizardProvisioning
          projectName={props.trimmedName}
          memberCount={props.memberCount}
          sources={draft.sources}
          disabled={props.isSubmitting}
          onRetry={props.onRetry}
        />
      );
  }
}
