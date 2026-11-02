import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  ChevronRight,
  FolderKanban,
  GitBranch,
  PlayCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import type {
  GenerationFailureReason,
  UnavailableReason,
} from "../../generation/OnboardingJourneyContext";
import { CenteredState, StateIcon } from "./CenteredState";

const LINK_CLASS =
  "inline-flex items-center gap-2 rounded-xl bg-app-brand px-4 py-2 text-sm font-semibold text-white hover:bg-app-brand-hover";

function NoProject({ isSwitcherEnabled }: { isSwitcherEnabled: boolean }) {
  return (
    <CenteredState>
      <StateIcon tone="warning">
        <FolderKanban className="h-7 w-7" />
      </StateIcon>
      <h2 className="mt-5 text-xl font-semibold text-app-text">No project selected</h2>
      <p className="mt-2 max-w-md text-sm text-app-text-muted">
        {isSwitcherEnabled
          ? "Select a project from the project switcher before creating your personalized onboarding path."
          : "You need to be assigned to a project before a personalized onboarding path can be created. Ask your project manager or administrator for access."}
      </p>
    </CenteredState>
  );
}

type SetupReason = "no-blueprint" | "several-blueprints" | "no-content";

/** Why a path cannot be built from this project, and where a manager goes to fix it. */
const SETUP_COPY: Record<
  SetupReason,
  { icon: ReactNode; title: string; body: string; to: string; link: string }
> = {
  "no-blueprint": {
    icon: <GitBranch className="h-7 w-7" />,
    title: "Onboarding isn't set up for this project yet",
    body: "An onboarding path is built from the project's published blueprint, and this project doesn't have one.",
    to: "/blueprints",
    link: "Open blueprints",
  },
  "several-blueprints": {
    icon: <GitBranch className="h-7 w-7" />,
    title: "This project has more than one onboarding blueprint",
    body: "An onboarding path is built from one published blueprint, and this project has several — so it can't tell which to use.",
    to: "/blueprints",
    link: "Open blueprints",
  },
  "no-content": {
    icon: <BookOpen className="h-7 w-7" />,
    title: "There's nothing to learn from yet",
    body: "An onboarding path is built from the project's knowledge base, and nothing has been added to it yet.",
    to: "/data-ingestion",
    link: "Add knowledge",
  },
};

function NotSetUp({ reason, canManage }: { reason: SetupReason; canManage: boolean }) {
  const copy = SETUP_COPY[reason];
  return (
    <CenteredState>
      <StateIcon tone="brand">{copy.icon}</StateIcon>
      <h2 className="mt-5 text-xl font-semibold text-app-text">{copy.title}</h2>
      <p className="mt-2 max-w-md text-sm text-app-text-muted">
        {copy.body}{" "}
        {canManage
          ? ""
          : "Your project manager can set this up — your path will be ready to build afterwards."}
      </p>
      {canManage ? (
        <Link to={copy.to} className={`mt-6 ${LINK_CLASS}`}>
          {copy.link}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </CenteredState>
  );
}

/**
 * The AI ran and found nothing in the project's knowledge to build a phase from. Usually that is
 * material that was just added and is still being processed; either way another start right now
 * would end the same, so it is not the button this page leads with.
 */
function NotEnoughKnowledge({ canManage, onStart }: { canManage: boolean; onStart: () => void }) {
  return (
    <CenteredState>
      <StateIcon tone="warning">
        <BookOpen className="h-7 w-7" />
      </StateIcon>
      <h2 className="mt-5 text-xl font-semibold text-app-text">Not enough project knowledge yet</h2>
      <p className="mt-2 max-w-md text-sm text-app-text-muted">
        Your path is written from what the project’s knowledge base covers, and right now that is
        not enough for any phase. If documents were added just now, they may still be processed —
        give it a few minutes.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {canManage ? (
          <Link to="/data-ingestion" className={LINK_CLASS}>
            Add knowledge
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        <Button variant="secondary" onClick={onStart} icon={<RefreshCw className="h-4 w-4" />}>
          Check again
        </Button>
      </div>
      {canManage ? null : (
        <p className="mt-4 max-w-md text-xs text-app-text-subtle">
          Your project manager can add documentation to the knowledge base.
        </p>
      )}
    </CenteredState>
  );
}

function NothingForYourRole() {
  return (
    <CenteredState>
      <StateIcon tone="warning">
        <GitBranch className="h-7 w-7" />
      </StateIcon>
      <h2 className="mt-5 text-xl font-semibold text-app-text">
        The blueprint has nothing for your role yet
      </h2>
      <p className="mt-2 max-w-md text-sm text-app-text-muted">
        Every phase of this project’s blueprint is meant for other roles or skills. Your project
        manager can open a phase up for you.
      </p>
    </CenteredState>
  );
}

function BuildError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-5 flex max-w-md items-start gap-2 rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-left text-sm text-app-danger-text"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </div>
  );
}

function buildLabel(checking: boolean, lastError: string | null): string {
  if (checking) return "Checking the project…";
  return lastError ? "Try again" : "Start personalization";
}

type BuildPromptProps = {
  unreachable: boolean;
  lastError: string | null;
  checking: boolean;
  onStart: () => void;
};

/** The way in: a button to build the path, or the reason the service could not be reached. */
function BuildPrompt({ unreachable, lastError, checking, onStart }: BuildPromptProps) {
  return (
    <CenteredState>
      <StateIcon tone={unreachable ? "warning" : "brand"}>
        {unreachable ? <AlertTriangle className="h-7 w-7" /> : <Sparkles className="h-7 w-7" />}
      </StateIcon>
      <h2 className="mt-5 text-2xl font-bold text-app-text">
        {unreachable ? "The onboarding service is not reachable" : "Build your onboarding path"}
      </h2>
      <p className="mt-2 max-w-md text-sm text-app-text-muted">
        {unreachable
          ? "Your path could not be put together because the AI service did not answer. Nothing was changed — try again in a moment."
          : "Your path is put together from your project’s blueprint and knowledge base: phases, steps and a few questions to check what stuck. It takes a few minutes and keeps running in the background."}
      </p>
      {lastError && !unreachable ? <BuildError message={lastError} /> : null}
      <Button
        className="mt-6"
        variant="primary"
        size="lg"
        onClick={onStart}
        loading={checking}
        disabled={checking}
        icon={<PlayCircle className="h-4 w-4" />}
      >
        {buildLabel(checking, lastError)}
      </Button>
    </CenteredState>
  );
}

function isSetupReason(reason: UnavailableReason | null): reason is SetupReason {
  return reason === "no-blueprint" || reason === "several-blueprints" || reason === "no-content";
}

type EmptyJourneyProps = {
  hasProject: boolean;
  isSwitcherEnabled: boolean;
  canManage: boolean;
  unavailableReason: UnavailableReason | null;
  lastError: string | null;
  /** Why the last generation came back without a path, when the backend could say. */
  failureReason: GenerationFailureReason | null;
  /** Whether a start could succeed is still being worked out. */
  checking: boolean;
  onStart: () => void;
};

/**
 * No path yet: either a clear way to build one, or a clear reason there is none -- never a raw
 * error from a generation that could only fail.
 */
export function EmptyJourney(props: EmptyJourneyProps) {
  const { hasProject, unavailableReason, failureReason, canManage, onStart } = props;
  if (!hasProject || unavailableReason === "no-project") {
    return <NoProject isSwitcherEnabled={props.isSwitcherEnabled} />;
  }
  if (isSetupReason(unavailableReason)) {
    return <NotSetUp reason={unavailableReason} canManage={canManage} />;
  }
  if (failureReason === "not-enough-knowledge") {
    return <NotEnoughKnowledge canManage={canManage} onStart={onStart} />;
  }
  if (failureReason === "no-phases") return <NothingForYourRole />;

  return (
    <BuildPrompt
      unreachable={failureReason === "ai-unavailable"}
      lastError={props.lastError}
      checking={props.checking}
      onStart={onStart}
    />
  );
}
