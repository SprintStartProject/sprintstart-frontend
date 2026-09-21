import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenCheck,
  CircleHelp,
  FilePlus2,
  KeyRound,
  Layers,
  Layers3,
  ListChecks,
  Loader2,
  Search,
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
import { BlueprintShapeStrip } from "../features/blueprints/components/BlueprintShapeStrip.tsx";
import { BlueprintVersionRail } from "../features/blueprints/components/BlueprintVersionRail.tsx";
import { groupBlueprints, type BlueprintRow } from "../features/blueprints/pathLifecycle.ts";
import { pathShape, shapeWord, type PathShape } from "../features/blueprints/pathShape.ts";
import type {
  BlueprintGraphNode,
  BlueprintPath,
  BlueprintPathOverview,
} from "../features/blueprints/types.ts";
import { blueprintService, type BlueprintScope } from "../services/blueprintService.ts";
import { useProjectContext } from "../features/projects/useProjectContext.ts";
import { useAuth } from "../context/useAuth.ts";

/** Left-to-right order of the scope bar, shared by the bar and the swipe gesture. */
const BLUEPRINT_SCOPE_ORDER = ["project", "global"] as const;

/** What a blueprint turns out to contain and be shaped like, once it has been read. */
type PathContents = {
  phases: number;
  aiPhases: number;
  steps: number;
  questions: number;
  gatedPhases: number;
  /** The graph as a thumbnail, or null when there is nothing to draw. */
  shape: PathShape | null;
  /** The same fact in words, for anybody the picture is not for. */
  shapeWord: string;
};

/**
 * What one blueprint holds, and what it looks like.
 *
 * The shape needs the graph, not the path: `GET /paths/{id}` carries no `graphX`, `graphY` or
 * `blockerIds` (only the graph endpoint does), and `toBlueprintPhase` fills those in as `null` and
 * `[]`. Summarising the path alone therefore drew every blueprint as a grid of unconnected dots
 * and described every one of them as "no order between any of them" -- which is the single fact
 * the thumbnail exists to convey. The detail page merges the two the same way, see `withGraphNodes`.
 */
function summarise(path: BlueprintPath, graphNodes: BlueprintGraphNode[]): PathContents {
  const nodesById = new Map(graphNodes.map((node) => [node.id, node]));
  const nodes = path.blueprintPhases.map((phase) => {
    const node = nodesById.get(phase.id);
    return {
      id: phase.id,
      graphX: node?.graphX ?? phase.graphX,
      graphY: node?.graphY ?? phase.graphY,
      blockerIds: node?.blockerIds ?? phase.blockerIds,
      position: phase.position,
    };
  });

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
    shape: pathShape(nodes),
    shapeWord: shapeWord(nodes),
  };
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

/**
 * Every blueprint in a scope, as things with a life rather than as rows with a status.
 *
 * The page this replaced sorted by the status of each blueprint's newest version, which is not a
 * fact about the blueprint. Open a draft of a live blueprint and its newest version is a draft, so
 * the blueprint left the "Published" section and appeared under "Drafts" — while every hire on the
 * project carried on being given it. The page said the opposite of what was true, at the exact
 * moment somebody was making a change and most needed to know what was still live.
 *
 * So the grouping is what hires get, not what the newest row says: in service, not in service yet,
 * retired. A draft is an attribute of a blueprint, drawn on it, never a place it goes. And each
 * blueprint carries its own graph as a thumbnail, because the question under "which of these do I
 * want" is what shape the thing is, and counts cannot answer it.
 */
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
  const [query, setQuery] = useState("");
  /** Guards against a scope switch landing the previous scope's answers. */
  const loadToken = useRef(0);

  const loadPaths = useCallback(async () => {
    if (!hasBlueprintScope) {
      setPaths([]);
      setContents({});
      setError(null);
      setIsLoading(false);
      return;
    }

    const token = ++loadToken.current;
    setIsLoading(true);
    setError(null);

    let overviews: BlueprintPathOverview[];
    try {
      overviews = await blueprintService.getPaths(scope);
    } catch (reason) {
      if (token !== loadToken.current) return;
      setError(reason instanceof Error ? reason.message : "Blueprint paths could not be loaded.");
      setIsLoading(false);
      return;
    }

    if (token !== loadToken.current) return;
    setPaths(overviews);
    setContents({});
    // The list is done here. Reading each path for its counts happens after, because a count is
    // never worth making somebody wait for the list — and a path that fails to read simply has no
    // counts rather than putting an error box over the page.
    setIsLoading(false);

    const summaries = await Promise.all(
      overviews.slice(0, CONTENTS_FETCH_LIMIT).map(async (overview) => {
        try {
          const [path, graph] = await Promise.all([
            blueprintService.getPath(scope, overview.id),
            blueprintService.getGraph(scope, overview.id),
          ]);
          return [overview.id, summarise(path, graph.nodes)] as const;
        } catch {
          return null;
        }
      }),
    );

    // A scope switch while these were in flight must not drop the previous scope's counts in.
    if (token !== loadToken.current) return;
    setContents(Object.fromEntries(summaries.filter((entry) => entry !== null)));
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

  // Matched on title and description together: somebody looking for "the one about deployments"
  // is as likely to have written that word in the description as in the title.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return paths;
    return paths.filter((path) =>
      `${path.title} ${path.description ?? ""}`.toLowerCase().includes(needle),
    );
  }, [paths, query]);

  const groups = useMemo(() => groupBlueprints(matches), [matches]);
  const openCount = paths.filter((path) => path.status === "DRAFT").length;

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

      <div className="flex flex-wrap items-center gap-3">
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

        {/* Shown from the first blueprint rather than past some threshold: a filter that appears
            only once a page is already hard to read is a filter nobody knows exists. */}
        {paths.length > 0 ? (
          <div className="relative ml-auto min-w-52 flex-1 sm:max-w-64 sm:flex-none">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-app-text-subtle"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a blueprint"
              aria-label="Find a blueprint"
              className="pl-9"
            />
          </div>
        ) : null}
      </div>

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
      ) : groups.length === 0 ? (
        <EmptyState icon={<Search className="h-8 w-8" />} title="Nothing matches that">
          No blueprint has &ldquo;{query}&rdquo; in its title or description.
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-app-text-muted">
            {paths.length} {paths.length === 1 ? "blueprint" : "blueprints"} in this scope
            {openCount > 0
              ? ` · ${openCount} with ${openCount === 1 ? "a draft" : "drafts"} open`
              : ""}
            .
          </p>

          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-app-text uppercase">
                  {group.title}
                  <span className="ml-2 font-normal text-app-text-muted normal-case">
                    ({group.rows.length})
                  </span>
                </h2>
                <p className="mt-0.5 text-xs text-app-text-muted">{group.hint}</p>
              </div>

              <div className="space-y-3">
                {group.rows.map((row) => (
                  <BlueprintRowCard
                    key={row.latest.id}
                    row={row}
                    contents={contents[row.latest.id]}
                    onOpen={() =>
                      void navigate(
                        `/blueprints/${row.lifecycle.openId}${isGlobal ? "?scope=global" : ""}`,
                      )
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
 * One blueprint: its shape, what it holds, where it stands, and the way in.
 *
 * A wide row rather than a tile in a grid. Two tiles side by side are compared by eye across a gap;
 * rows stack, and the things worth comparing — how big, what shape, is anything pending — land in
 * the same column on every one of them, which is what makes a page of them scannable rather than
 * merely tidy.
 */
function BlueprintRowCard({
  row,
  contents,
  onOpen,
}: {
  row: BlueprintRow;
  contents?: PathContents;
  onOpen: () => void;
}) {
  const { latest, lifecycle } = row;
  const hasDraft = lifecycle.draft !== null;

  return (
    <article
      className={[
        "relative flex min-w-0 flex-col gap-4 rounded-2xl border bg-app-surface p-5 transition-shadow sm:flex-row sm:items-start",
        "shadow-sm hover:shadow-app-brand-lift",
        // A pending draft is the one thing on this page waiting on the reader, so it is the one
        // thing given a border of its own.
        hasDraft ? "border-app-warning-border" : "border-app-border",
      ].join(" ")}
    >
      {/* The portrait, at a fixed size so every row's shape is drawn at the same scale to compare. */}
      <div className="flex h-20 w-full shrink-0 items-center justify-center rounded-xl border border-app-border bg-app-surface-muted p-2 sm:w-44">
        {contents?.shape ? (
          <BlueprintShapeStrip shape={contents.shape} className="h-full w-full" />
        ) : (
          <span className="text-[11px] text-app-text-subtle">
            {contents ? "Nothing in it yet" : "Reading…"}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          {/*
            The title is the control, and its own `::after` is stretched over the whole row — so
            clicking anywhere opens the blueprint, while what a keyboard reaches and what a screen
            reader announces is still one button with the blueprint's name on it.

            It is the *only* control. There used to be a second one in the corner saying "Open",
            "Continue draft" or "Read it", which went exactly where the row already went and said
            what the rail underneath already says — "v5 being written", "Retired at v4". A card that
            is one big target does not need a smaller target on top of it repeating itself.
          */}
          <h3 className="min-w-0 text-lg font-semibold text-app-text">
            <button
              type="button"
              onClick={onOpen}
              className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-app-focus"
            >
              {latest.title}
            </button>
          </h3>
          {lifecycle.retired ? (
            <Badge variant="neutral">Retired</Badge>
          ) : lifecycle.inService !== null ? (
            <Badge variant="success">Hires get this</Badge>
          ) : (
            <Badge variant="warning">Nobody has this yet</Badge>
          )}
        </div>

        <p className="line-clamp-2 text-sm leading-6 text-app-text-subtle">
          {latest.description || "No description yet."}
        </p>

        <BlueprintVersionRail lifecycle={lifecycle} />

        {contents ? (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-app-text-muted">
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
            {/* The picture's fact, said. It is also the more useful half for a reader in a hurry. */}
            <span className="text-app-text-subtle">{contents.shapeWord}</span>
          </dl>
        ) : (
          // A count that has not arrived is left blank rather than shown as zero: "0 phases" and
          // "not read yet" are very different things to somebody deciding which blueprint to open.
          <p className="text-xs text-app-text-subtle">Reading contents…</p>
        )}

        {contents && contents.phases > 0 && contents.aiPhases === contents.phases ? (
          <p className="flex items-start gap-1.5 rounded-lg bg-app-surface-muted px-3 py-2 text-xs text-app-text-muted">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            Every phase is AI-enhanced, so this blueprint has no content of its own to fall back on
            if the project&rsquo;s material cannot support it.
          </p>
        ) : null}
      </div>
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
