import { useCallback, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  ClipboardList,
  Layers,
  List,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { FilterSelect, type FilterSelectOption } from "../components/ui/FilterSelect";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { SpotlightCard } from "../components/ui/SpotlightCard";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../context/useToast";
import { useFetch } from "../hooks/useFetch";
import {
  BOARD_STAGES,
  STAGE_LABELS,
  type BoardStage,
} from "../features/board/layout/boardStructure";
import { BlueprintCanvas } from "../features/card-blueprints/canvas/BlueprintCanvas";
import {
  autoLayoutPositions,
  wouldCycle,
  type CanvasPosition,
} from "../features/card-blueprints/canvas/canvasLayout";
import { useCanvasPositions } from "../features/card-blueprints/canvas/useCanvasPositions";
import { CardBlueprintEditor } from "../features/card-blueprints/components/CardBlueprintEditor";
import { cardBlueprintService } from "../features/card-blueprints/cardBlueprintService";
import { previewBands } from "../features/card-blueprints/preview";
import {
  blueprintsForRoles,
  EMPTY_DRAFT,
  type CardBlueprint,
  type CardBlueprintDraft,
} from "../features/card-blueprints/types";
import { useProjectContext } from "../features/projects/useProjectContext";
import { getProjectRoles } from "../services/teamManagementService";

/** The sentinel for "not filtered by role", which is not the same as "a hire with no role". */
const EVERY_ROLE = "__all__";

/**
 * Where a PM writes the cards every new hire starts with.
 *
 * The board fills itself from what the system observes and from what the buddy judges worth
 * keeping. Neither covers what the *team* knows — that a backend hire needs the on-call rota
 * explained in their first week, that everyone reads the incident write-up before touching deploys.
 * That has been living in a PM's head, said once per hire and forgotten in a busy month.
 *
 * So this page is that knowledge, written down once and aimed at the roles it applies to. It is
 * authoring, not monitoring: nothing here is about any particular hire, and no hire's board is
 * changed by opening it.
 *
 * **It is laid out like the thing it produces.** The first cut was one flat list in creation order
 * with a numbered summary beside it, which is a fine way to store blueprints and a poor way to
 * think about them: a PM cannot tell from a list of twelve whether a new hire's first day is
 * reasonable or brutal, because the board does not show a list of twelve. So the blueprints are
 * grouped into the same stages the board bands by — a heading that says "Now · 9 cards" is the
 * warning a flat list could not give — and the preview draws what the cards actually become,
 * chains and all.
 *
 * One role selector drives both halves. "What does a new backend hire get" is the only question
 * anybody asks here, and answering it in the preview while the list beside it still shows
 * everything would be two screens disagreeing about what is being discussed.
 *
 * Scoped to the globally selected project, like every other PM surface.
 */
export function CardBlueprintsPage() {
  const { selectedProjectId, isLoading: projectsLoading } = useProjectContext();
  const toast = useToast();

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const { data: blueprints, loading } = useFetch<CardBlueprint[]>(
    async () => (selectedProjectId ? await cardBlueprintService.list(selectedProjectId) : []),
    [selectedProjectId, reloadKey],
  );
  const { data: roles } = useFetch(async () => await getProjectRoles(), []);

  const all = useMemo(() => blueprints ?? [], [blueprints]);
  const projectRoles = useMemo(() => roles ?? [], [roles]);

  const [editing, setEditing] = useState<CardBlueprint | null>(null);
  const [draft, setDraft] = useState<CardBlueprintDraft>(EMPTY_DRAFT);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /** Whose board both halves of this page are talking about. */
  const [roleId, setRoleId] = useState<string>(EVERY_ROLE);

  /**
   * Which view is open. The canvas is the default: the first question anybody has about a set of
   * blueprints is what order they come in, and that is the one thing a column of rows cannot show.
   * The list stays because it is the faster surface to *write* on and the only one that works from
   * a keyboard alone.
   */
  const [view, setView] = useState<"canvas" | "list">("canvas");

  const { positions, place, replaceAll } = useCanvasPositions(selectedProjectId);

  const roleOptions: FilterSelectOption<string>[] = [
    { value: EVERY_ROLE, label: "Every role" },
    ...projectRoles.map((role) => ({ value: role.id, label: role.name })),
  ];

  const roleName = (id: string) =>
    projectRoles.find((role) => role.id === id)?.name ?? "Unknown role";

  /**
   * The blueprints in play: all of them, or the ones that reach the chosen role.
   *
   * `blueprintsForRoles` is the same function the generator uses, so what this page narrows to is
   * exactly what that hire's board would be filled from — not a second rule that happens to agree.
   */
  const shown = useMemo(
    () => (roleId === EVERY_ROLE ? all : blueprintsForRoles(all, [roleId])),
    [all, roleId],
  );

  const bands = useMemo(() => previewBands(shown), [shown]);

  /** The chosen role's blueprints, grouped by stage, in the PM's own order. */
  const sections = useMemo(
    () =>
      BOARD_STAGES.map((stage) => ({
        stage,
        blueprints: shown.filter((blueprint) => blueprint.stage === stage),
      })).filter((section) => section.blueprints.length > 0),
    [shown],
  );

  function openNew() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setIsOpen(true);
  }

  const openEdit = useCallback((blueprint: CardBlueprint) => {
    setEditing(blueprint);
    const { id: _id, position: _position, ...rest } = blueprint;
    setDraft(rest);
    setIsOpen(true);
  }, []);

  async function handleSave() {
    if (!selectedProjectId) return;

    setSaving(true);
    try {
      await cardBlueprintService.save(selectedProjectId, editing?.id ?? null, draft);
      setIsOpen(false);
      reload();
      toast.success(editing ? "Blueprint saved" : "Blueprint created");
    } catch {
      toast.error("That blueprint couldn't be saved", { description: "Nothing changed." });
    } finally {
      setSaving(false);
    }
  }

  const handleRemove = useCallback(
    (blueprint: CardBlueprint) => {
      if (!selectedProjectId) return;

      void cardBlueprintService
        .remove(selectedProjectId, blueprint.id)
        .then(() => {
          reload();
          toast.info(`"${blueprint.title}" removed`, {
            description: "Boards that already have this card keep it.",
          });
        })
        .catch(() => toast.error("That blueprint couldn't be removed"));
    },
    [reload, selectedProjectId, toast],
  );

  /** One blueprint, with the two fields the service owns taken off, ready to be written back. */
  const draftOf = (blueprint: CardBlueprint): CardBlueprintDraft => {
    const { id: _id, position: _position, ...rest } = blueprint;

    return rest;
  };

  /**
   * A card was dragged: it is remembered where it was dropped, and if that was the other band, the
   * blueprint's stage follows.
   *
   * The arrangement is written even when the stage did not change, because *where* a PM put a card
   * is the work they did on this canvas; losing it on every drag that stayed inside a band would
   * make the canvas a toy.
   */
  const handlePlace = useCallback(
    (id: string, position: CanvasPosition, stage: BoardStage) => {
      place(id, position);

      const blueprint = all.find((other) => other.id === id);
      if (!selectedProjectId || !blueprint || blueprint.stage === stage) return;

      void cardBlueprintService
        .save(selectedProjectId, id, { ...draftOf(blueprint), stage })
        .then(() => reload())
        .catch(() => toast.error("That card's stage couldn't be saved"));
    },
    [all, place, reload, selectedProjectId, toast],
  );

  /**
   * An edge was drawn or cut.
   *
   * The loop check is here as well as on the canvas' own handles: the handles refuse a connection
   * that would close a ring, and this refuses one that somehow got past them — a chain a hire can
   * never start is not a thing worth storing, however it was asked for.
   */
  const handleChain = useCallback(
    (id: string, afterId: string | null) => {
      const blueprint = all.find((other) => other.id === id);
      if (!selectedProjectId || !blueprint) return;

      if (afterId !== null && wouldCycle(all, id, afterId)) {
        toast.error("Those cards would wait on each other", {
          description: "Nothing in a loop can be first, so nobody could ever start it.",
        });

        return;
      }

      void cardBlueprintService
        .save(selectedProjectId, id, { ...draftOf(blueprint), afterId })
        .then(() => reload())
        .catch(() => toast.error("That link couldn't be saved"));
    },
    [all, reload, selectedProjectId, toast],
  );

  /**
   * A palette tile was dropped on the canvas.
   *
   * The blueprint is created before it has been written, which is deliberate: the card has to exist
   * to hold the position and the band it was dropped in, and a panel that saved those only on
   * "create" would throw away the drop the moment somebody paused to think about the title. It
   * arrives named "New card" with the editor open on it; the toolbar's remove button undoes it.
   */
  const handleCreateAt = useCallback(
    (position: CanvasPosition, stage: BoardStage, roleIds: string[]) => {
      if (!selectedProjectId) return;

      void cardBlueprintService
        .save(selectedProjectId, null, { ...EMPTY_DRAFT, title: "New card", stage, roleIds })
        .then((created) => {
          place(created.id, position);
          reload();
          openEdit(created);
        })
        .catch(() => toast.error("That card couldn't be created"));
    },
    [openEdit, place, reload, selectedProjectId, toast],
  );

  /** Lays every blueprint out from scratch — the whole project's, not just the filtered ones. */
  const handleAutoLayout = useCallback(() => {
    replaceAll(autoLayoutPositions(all));
  }, [all, replaceAll]);

  /**
   * Moves a blueprint past its neighbour *within its own stage*.
   *
   * The stored order is one list across every stage, because that is the order the cards are
   * created in. What a PM is arranging, though, is the order inside a band — the position of a
   * "Later" card relative to a "Now" one is not something they can see or care about. So the swap
   * is with the next blueprint sharing this one's stage, wherever that sits in the global list.
   */
  async function move(blueprint: CardBlueprint, direction: "up" | "down") {
    if (!selectedProjectId) return;

    const siblings = all.filter((other) => other.stage === blueprint.stage);
    const at = siblings.findIndex((other) => other.id === blueprint.id);
    const neighbour = siblings[direction === "up" ? at - 1 : at + 1];
    if (!neighbour) return;

    const ids = all.map((other) => other.id);
    const from = ids.indexOf(blueprint.id);
    const to = ids.indexOf(neighbour.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];

    await cardBlueprintService.reorder(selectedProjectId, ids);
    reload();
  }

  const isFirstInStage = (blueprint: CardBlueprint) =>
    all.filter((other) => other.stage === blueprint.stage)[0]?.id === blueprint.id;

  const isLastInStage = (blueprint: CardBlueprint) => {
    const siblings = all.filter((other) => other.stage === blueprint.stage);

    return siblings[siblings.length - 1]?.id === blueprint.id;
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-app-border bg-app-bg">
        <div className="app-page-frame py-6">
          <PageHeader
            icon={ClipboardList}
            title="Card blueprints"
            subtitle="The cards every new hire starts with, and which roles get which."
            actions={
              <Button
                variant="primary"
                onClick={openNew}
                disabled={!selectedProjectId}
                icon={<Plus className="h-4 w-4" aria-hidden="true" />}
              >
                New blueprint
              </Button>
            }
          />
        </div>
      </header>

      <main className="app-page-frame space-y-5 py-6 lg:py-8">
        {!selectedProjectId && !projectsLoading ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" aria-hidden="true" />}
            title="No project selected"
          >
            Blueprints belong to a project. Pick one in the sidebar to see and write its cards.
          </EmptyState>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" label="Loading blueprints" />
          </div>
        ) : (
          <>
            {/* One control, above every view: it decides whose board is being discussed, and both
                the canvas and the list are then talking about that hire and nobody else. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <FilterSelect
                  label="Whose board"
                  value={roleId}
                  options={roleOptions}
                  onChange={setRoleId}
                />
                <p className="text-xs text-app-text-muted">
                  {roleId === EVERY_ROLE
                    ? `${all.length} ${all.length === 1 ? "blueprint" : "blueprints"} on this project`
                    : `${shown.length} of ${all.length} reach a ${roleName(roleId)}`}
                </p>
              </div>

              <SegmentedTabs
                value={view}
                onChange={setView}
                layoutId="card-blueprints-view"
                ariaLabel="How to show the blueprints"
                options={[
                  {
                    value: "canvas",
                    label: "Canvas",
                    icon: <Workflow className="h-4 w-4" aria-hidden="true" />,
                  },
                  {
                    value: "list",
                    label: "List",
                    icon: <List className="h-4 w-4" aria-hidden="true" />,
                  },
                ]}
              />
            </div>

            {view === "canvas" ? (
              /* Tall enough that both bands and a chain of three fit without panning, and bounded
                 rather than page-height so the canvas scrolls itself instead of the page. */
              <div className="h-[calc(100vh-17rem)] min-h-[520px]">
                <BlueprintCanvas
                  blueprints={shown}
                  allBlueprints={all}
                  roles={projectRoles}
                  positions={positions}
                  onPlace={handlePlace}
                  onChain={handleChain}
                  onCreateAt={handleCreateAt}
                  onEdit={openEdit}
                  onRemove={handleRemove}
                  onAutoLayout={handleAutoLayout}
                />
              </div>
            ) : all.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-8 w-8" aria-hidden="true" />}
                title="No blueprints yet"
                action={
                  <Button variant="primary" onClick={openNew}>
                    Write the first one
                  </Button>
                }
              >
                A blueprint is a card every matching new hire starts with — the on-call rota for
                backend, the design handover for UX, the incident write-up for everybody. Write it
                once here instead of saying it once per hire.
              </EmptyState>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-6">
                  {sections.length === 0 ? (
                    <EmptyState size="sm">
                      Nothing reaches this role yet. A blueprint with no roles ticked would.
                    </EmptyState>
                  ) : (
                    sections.map((section) => (
                      <section key={section.stage} className="space-y-3">
                        {/* The heading a flat list could not give: nine cards due on day one is a
                        judgement a PM can make in a glance and cannot make from a list. */}
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-1">
                          <h2 className="text-sm font-semibold text-app-text">
                            {STAGE_LABELS[section.stage].title}
                          </h2>
                          <span className="text-xs text-app-text-muted tabular-nums">
                            {section.blueprints.length}{" "}
                            {section.blueprints.length === 1 ? "card" : "cards"}
                          </span>
                          <span className="text-xs text-app-text-subtle">
                            {STAGE_LABELS[section.stage].hint}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {section.blueprints.map((blueprint) => (
                            <SpotlightCard key={blueprint.id} roundedClassName="rounded-2xl">
                              <article className="flex items-start gap-3 p-4">
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-semibold text-app-text">
                                      {blueprint.title}
                                    </h3>

                                    {blueprint.items.length > 0 && (
                                      <Badge variant="neutral" size="sm" className="gap-1">
                                        <CheckSquare className="h-3 w-3" aria-hidden="true" />
                                        {blueprint.items.length}
                                      </Badge>
                                    )}

                                    {blueprint.afterId && (
                                      <Badge variant="neutral" size="sm" className="gap-1">
                                        <Lock className="h-3 w-3" aria-hidden="true" />
                                        After{" "}
                                        {all.find((other) => other.id === blueprint.afterId)
                                          ?.title ?? "a removed blueprint"}
                                      </Badge>
                                    )}
                                  </div>

                                  {blueprint.description && (
                                    <p className="text-sm text-app-text-muted">
                                      {blueprint.description}
                                    </p>
                                  )}

                                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-app-text-muted">
                                    <Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    {blueprint.roleIds.length === 0
                                      ? "Everybody on the project"
                                      : blueprint.roleIds.map(roleName).join(", ")}
                                  </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    iconOnly
                                    onClick={() => void move(blueprint, "up")}
                                    disabled={isFirstInStage(blueprint)}
                                    aria-label={`Move "${blueprint.title}" earlier`}
                                  >
                                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    iconOnly
                                    onClick={() => void move(blueprint, "down")}
                                    disabled={isLastInStage(blueprint)}
                                    aria-label={`Move "${blueprint.title}" later`}
                                  >
                                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    iconOnly
                                    onClick={() => openEdit(blueprint)}
                                    aria-label={`Edit "${blueprint.title}"`}
                                  >
                                    <Pencil className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                  <Button
                                    variant="dangerGhost"
                                    size="sm"
                                    iconOnly
                                    onClick={() => handleRemove(blueprint)}
                                    aria-label={`Remove "${blueprint.title}"`}
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  </Button>
                                </div>
                              </article>
                            </SpotlightCard>
                          ))}
                        </div>
                      </section>
                    ))
                  )}
                </div>

                <aside className="min-w-0">
                  <div className="space-y-3 xl:sticky xl:top-6">
                    <div className="px-1">
                      <h2 className="text-sm font-semibold text-app-text">
                        {roleId === EVERY_ROLE
                          ? "What every hire gets"
                          : `What a new ${roleName(roleId)} gets`}
                      </h2>
                      <p className="text-xs text-app-text-muted">
                        Their board on day one — the stages it folds into, and the runs that stand
                        as one card.
                      </p>
                    </div>

                    {bands.length === 0 ? (
                      <EmptyState size="sm">Nothing would be on it yet.</EmptyState>
                    ) : (
                      <div className="space-y-5">
                        {bands.map((band) => (
                          <section key={band.stage} className="space-y-2">
                            <p className="flex items-baseline gap-2 px-1">
                              <span className="text-xs font-semibold text-app-text">
                                {STAGE_LABELS[band.stage].title}
                              </span>
                              <span className="text-xs text-app-text-muted tabular-nums">
                                {band.entries.length} {band.entries.length === 1 ? "card" : "cards"}
                              </span>
                            </p>

                            {band.entries.map((entry) => (
                              <div
                                key={entry.blueprint.id}
                                className="rounded-xl border border-app-border bg-app-surface p-3"
                              >
                                <p className="flex items-center gap-1.5 text-sm font-medium text-app-text">
                                  <CheckSquare
                                    className="h-3.5 w-3.5 shrink-0 text-app-text-muted"
                                    aria-hidden="true"
                                  />
                                  <span className="min-w-0 truncate">{entry.blueprint.title}</span>
                                </p>

                                {entry.blueprint.items.length > 0 && (
                                  <ul className="mt-1.5 space-y-0.5">
                                    {entry.blueprint.items.slice(0, 3).map((item, index) => (
                                      <li
                                        key={`${item}-${index}`}
                                        className="truncate text-xs text-app-text-muted"
                                      >
                                        · {item}
                                      </li>
                                    ))}
                                    {entry.blueprint.items.length > 3 && (
                                      <li className="text-xs text-app-text-subtle">
                                        +{entry.blueprint.items.length - 3} more
                                      </li>
                                    )}
                                  </ul>
                                )}

                                {/* A run is one card with the rest behind it, so the preview says so
                                rather than listing them as separate cards the hire will not see. */}
                                {entry.behind.length > 0 && (
                                  <p className="mt-2 flex items-center gap-1.5 text-xs text-app-brand-text">
                                    <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    <span className="min-w-0 truncate">
                                      then {entry.behind.map((behind) => behind.title).join(" → ")}
                                    </span>
                                  </p>
                                )}

                                {entry.waitsOn && (
                                  <p className="mt-2 flex items-center gap-1.5 text-xs text-app-text-muted">
                                    <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    <span className="min-w-0 truncate">
                                      waits for {entry.waitsOn.title}
                                    </span>
                                  </p>
                                )}
                              </div>
                            ))}
                          </section>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            )}
          </>
        )}
      </main>

      <CardBlueprintEditor
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        editing={editing}
        draft={draft}
        onChange={setDraft}
        onSave={() => void handleSave()}
        saving={saving}
        roles={projectRoles}
        others={all.filter((blueprint) => blueprint.id !== editing?.id)}
      />
    </div>
  );
}
