import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  CircleHelp,
  FilePlus2,
  KeyRound,
  Layers,
  Layers3,
  ListChecks,
  Loader2,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { Badge } from "../components/ui/Badge.tsx";
import { Button } from "../components/ui/Button.tsx";
import { SegmentedTabs } from "../components/ui/SegmentedTabs.tsx";
import { useSwipeableTabs } from "../hooks/useHorizontalWheelNavigation.ts";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { Field } from "../components/ui/Field.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { Textarea } from "../components/ui/Textarea.tsx";
import type { BlueprintPath, BlueprintPathOverview } from "../features/blueprints/types.ts";
import { blueprintService, type BlueprintScope } from "../services/blueprintService.ts";
import { useProjectContext } from "../features/projects/useProjectContext.ts";
import { useAuth } from "../context/useAuth.ts";

/** Left-to-right order of the scope bar, shared by the bar and the swipe gesture. */
const BLUEPRINT_SCOPE_ORDER = ["project", "global"] as const;

/**
 * The order the groups are read in: what needs finishing, what is in service, what is history.
 *
 * A flat grid sorted by nothing put an archived version somebody reverted from last month beside
 * the draft they are in the middle of writing.
 */
const STATUS_GROUPS = [
  {
    status: "DRAFT" as const,
    title: "Drafts",
    hint: "Not reaching anybody yet. Publishing one replaces the version in service.",
  },
  {
    status: "ACTIVE" as const,
    title: "Published",
    hint: "What a new hire on this project is given.",
  },
  {
    status: "ARCHIVED" as const,
    title: "Archived",
    hint: "Kept as they were. Hires who were given one keep their copy.",
  },
];

/** What a blueprint turns out to contain, once its nested content has been read. */
type PathContents = {
  phases: number;
  aiPhases: number;
  steps: number;
  questions: number;
  gatedPhases: number;
};

function summarise(path: BlueprintPath): PathContents {
  return {
    phases: path.blueprintPhases.length,
    aiPhases: path.blueprintPhases.filter((phase) => phase.type === "AI_ENHANCED").length,
    steps: path.blueprintPhases.reduce((total, phase) => total + phase.blueprintSteps.length, 0),
    questions: path.blueprintPhases.reduce(
      (total, phase) => total + phase.blueprintCheckQuestions.length,
      0,
    ),
    gatedPhases: path.blueprintPhases.filter((phase) => (phase.requirements?.length ?? 0) > 0)
      .length,
  };
}

function statusVariant(status: BlueprintPathOverview["status"]) {
  return status === "ACTIVE" ? "success" : status === "DRAFT" ? "warning" : "neutral";
}

/**
 * How many blueprints are worth reading in full to fill in their counts.
 *
 * The overview endpoint carries no counts (`GetBlueprintPathOverviewResponse` is id, key, version,
 * revision, title, description, status), so the only way to say "sixteen phases" is to read each
 * path. That is fine for the handful a project has and is not fine unbounded, hence the cap.
 * **Backend TODO:** phase/step/question counts on the overview response would remove this entirely.
 */
const CONTENTS_FETCH_LIMIT = 24;

/** Lists the authoring blueprint paths for a scope and starts the path-creation flow. */
export function BlueprintPathsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const { selectedProjectId, isLoading: isProjectLoading } = useProjectContext();
  const isAdmin = profile?.permissionGroup === "ADMIN";
  const isGlobal = searchParams.get("scope") === "global" && isAdmin;
  const scope = useMemo<BlueprintScope>(
    () => (isGlobal ? { kind: "global" } : { kind: "project", projectId: selectedProjectId }),
    [isGlobal, selectedProjectId],
  );
  const hasBlueprintScope = isGlobal || selectedProjectId !== "";
  const [paths, setPaths] = useState<BlueprintPathOverview[]>([]);
  const [contents, setContents] = useState<Record<string, PathContents>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadPaths = useCallback(async () => {
    if (!hasBlueprintScope) {
      setPaths([]);
      setContents({});
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const overviews = await blueprintService.getPaths(scope);
      setPaths(overviews);
      setContents({});

      // Read in the background: the cards are useful the moment the overviews land, and a count is
      // never worth making somebody wait for the list. A path that fails to read simply has no
      // counts — an error box over a whole page because one number is missing helps nobody.
      const readable = overviews.slice(0, CONTENTS_FETCH_LIMIT);
      const summaries = await Promise.all(
        readable.map(async (overview) => {
          try {
            return [
              overview.id,
              summarise(await blueprintService.getPath(scope, overview.id)),
            ] as const;
          } catch {
            return null;
          }
        }),
      );
      setContents(Object.fromEntries(summaries.filter((entry) => entry !== null)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Blueprint paths could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [hasBlueprintScope, scope]);

  useEffect(() => {
    if (!isGlobal && isProjectLoading) return;

    const loadTimeout = window.setTimeout(() => {
      void loadPaths();
    }, 0);
    return () => window.clearTimeout(loadTimeout);
  }, [isGlobal, isProjectLoading, loadPaths]);

  async function createPath(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasBlueprintScope) return;

    setIsSaving(true);
    setError(null);
    try {
      const path = await blueprintService.createPath(scope, { title, description });
      void navigate(`/blueprints/${path.id}${isGlobal ? "?scope=global" : ""}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Blueprint path could not be created.");
    } finally {
      setIsSaving(false);
    }
  }

  // Two-finger swipe between the two scopes, for people who would rather not aim at the bar.
  const swipeRef = useSwipeableTabs<"project" | "global", HTMLElement>({
    order: BLUEPRINT_SCOPE_ORDER,
    value: isGlobal ? "global" : "project",
    onChange: (next) => setSearchParams(next === "global" ? { scope: "global" } : {}),
    enabled: isAdmin,
  });

  const groups = STATUS_GROUPS.map((group) => ({
    ...group,
    items: paths.filter((path) => path.status === group.status),
  })).filter((group) => group.items.length > 0);

  const draftCount = paths.filter((path) => path.status === "DRAFT").length;

  return (
    // The swipe listens on the page rather than on the bar: having to be over the control to change
    // scope makes the gesture feel like it only works in one corner.
    <main ref={swipeRef} className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={Layers3}
        title="Blueprint paths"
        subtitle="Design reusable onboarding paths without changing an employee's live onboarding progress."
        actions={
          <Button
            variant="primary"
            icon={<FilePlus2 className="h-4 w-4" />}
            onClick={() => setIsCreateOpen(true)}
            disabled={!hasBlueprintScope || (!isGlobal && isProjectLoading)}
          >
            New blueprint path
          </Button>
        }
      />

      {isAdmin ? (
        <SegmentedTabs
          value={isGlobal ? "global" : "project"}
          options={[
            { value: "project", label: "Project blueprints" },
            { value: "global", label: "Global blueprints" },
          ]}
          onChange={(next) => setSearchParams(next === "global" ? { scope: "global" } : {})}
          layoutId="blueprint-scope-pill"
          ariaLabel="Blueprint scope"
        />
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-app-danger-bg p-4 text-sm text-app-danger-text">
          {error}
        </p>
      ) : null}

      {(!isGlobal && isProjectLoading) || isLoading ? (
        <div className="flex items-center gap-3 py-12 text-app-text-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading blueprint paths…
        </div>
      ) : !hasBlueprintScope ? (
        <EmptyState icon={<BookOpenCheck className="h-8 w-8" />} title="No project available">
          Create or join a project before adding project blueprint paths.
        </EmptyState>
      ) : paths.length === 0 ? (
        <EmptyState icon={<BookOpenCheck className="h-8 w-8" />} title="No blueprint paths yet">
          Create the first reusable onboarding path to begin authoring.
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-app-text-muted">
            {paths.length} {paths.length === 1 ? "blueprint" : "blueprints"} in this scope
            {draftCount > 0
              ? ` · ${draftCount} ${draftCount === 1 ? "draft waiting" : "drafts waiting"} to be published`
              : ""}
            .
          </p>

          {groups.map((group) => (
            <section key={group.status} className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-app-text uppercase">
                  {group.title}
                  <span className="ml-2 font-normal text-app-text-muted normal-case">
                    ({group.items.length})
                  </span>
                </h2>
                <p className="mt-0.5 text-xs text-app-text-muted">{group.hint}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {group.items.map((path) => (
                  <BlueprintCard
                    key={path.id}
                    path={path}
                    contents={contents[path.id]}
                    onOpen={() =>
                      void navigate(`/blueprints/${path.id}${isGlobal ? "?scope=global" : ""}`)
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <Modal
        isOpen={isCreateOpen}
        title="New blueprint path"
        description="Start with the purpose of this reusable onboarding path."
        onClose={() => setIsCreateOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="create-blueprint-path" loading={isSaving}>
              Create path
            </Button>
          </>
        }
      >
        <form
          id="create-blueprint-path"
          className="space-y-4"
          onSubmit={(event) => void createPath(event)}
        >
          <Field label="Title" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </Field>
          <Field label="Description" required>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </Field>
        </form>
      </Modal>
    </main>
  );
}

/**
 * One blueprint, with enough on it to choose between two of them without opening either.
 *
 * The card used to carry a title, a version number and a status chip, which answers none of the
 * questions somebody scanning this page actually has: how big is it, is any of it AI-assembled, is
 * it gated to particular roles, and — for a draft — what is running while this one is written.
 */
function BlueprintCard({
  path,
  contents,
  onOpen,
}: {
  path: BlueprintPathOverview;
  contents?: PathContents;
  onOpen: () => void;
}) {
  const isDraft = path.status === "DRAFT";

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm transition-shadow hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-lg font-semibold text-app-text">{path.title}</h3>
        <Badge variant={statusVariant(path.status)}>
          {path.status === "ACTIVE" ? "Published" : path.status === "DRAFT" ? "Draft" : "Archived"}{" "}
          · v{path.version}
        </Badge>
      </div>

      {/*
        A draft opened from a published version is numbered one above it (the backend copies
        `active.version + 1`), and a path that was never published starts at 0 — so what is in
        service while this draft is written can be said without asking for the history.
      */}
      {isDraft ? (
        <p className="mt-1 text-sm text-app-warning-text">
          {path.version > 0
            ? `Version ${path.version - 1} stays published until you publish this one.`
            : "Never published — no hire has been given this yet."}
        </p>
      ) : null}

      <p className="mt-3 line-clamp-3 min-h-15 text-sm leading-6 text-app-text-subtle">
        {path.description || "No description yet."}
      </p>

      {contents ? (
        <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-app-text-muted">
          <Stat icon={Layers} label="phases" value={contents.phases} />
          <Stat icon={ListChecks} label="steps" value={contents.steps} />
          <Stat icon={CircleHelp} label="knowledge checks" value={contents.questions} />
          {contents.aiPhases > 0 ? (
            <Stat
              icon={Sparkles}
              label={`AI-enhanced ${contents.aiPhases === 1 ? "phase" : "phases"}`}
              value={contents.aiPhases}
            />
          ) : null}
          {contents.gatedPhases > 0 ? (
            <Stat
              icon={KeyRound}
              label={`gated ${contents.gatedPhases === 1 ? "phase" : "phases"}`}
              value={contents.gatedPhases}
            />
          ) : null}
        </dl>
      ) : (
        // A count that has not arrived is left blank rather than shown as zero: "0 phases" and
        // "not read yet" are very different things to somebody deciding which blueprint to open.
        <p className="mt-4 text-xs text-app-text-subtle">Reading contents…</p>
      )}

      {contents && contents.phases > 0 && contents.aiPhases === contents.phases ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-app-surface-muted px-3 py-2 text-xs text-app-text-muted">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          Every phase is AI-enhanced, so this blueprint has no content of its own to fall back on if
          the project&rsquo;s material cannot support it.
        </p>
      ) : null}

      <Button
        className="mt-5 self-start"
        variant={isDraft ? "primary" : "secondary"}
        icon={<PencilLine className="h-4 w-4" />}
        onClick={onOpen}
      >
        {isDraft ? "Continue draft" : "Open blueprint"}
      </Button>
    </article>
  );
}

/** One number on a card, with the word that says what it counts — never the number alone. */
function Stat({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-app-text-subtle" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd className="text-app-text">
        <span className="font-semibold tabular-nums">{value}</span>{" "}
        <span className="text-app-text-muted">{label}</span>
      </dd>
    </div>
  );
}
