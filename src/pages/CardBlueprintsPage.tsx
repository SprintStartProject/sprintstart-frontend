import { useCallback, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  ClipboardList,
  Layers,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { FilterSelect, type FilterSelectOption } from "../components/ui/FilterSelect";
import { SpotlightCard } from "../components/ui/SpotlightCard";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../context/useToast";
import { useFetch } from "../hooks/useFetch";
import { BOARD_STAGES, STAGE_LABELS } from "../features/board/layout/boardStructure";
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

  function openEdit(blueprint: CardBlueprint) {
    setEditing(blueprint);
    const { id: _id, position: _position, ...rest } = blueprint;
    setDraft(rest);
    setIsOpen(true);
  }

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

  async function handleRemove(blueprint: CardBlueprint) {
    if (!selectedProjectId) return;

    try {
      await cardBlueprintService.remove(selectedProjectId, blueprint.id);
      reload();
      toast.info(`"${blueprint.title}" removed`, {
        description: "Boards that already have this card keep it.",
      });
    } catch {
      toast.error("That blueprint couldn't be removed");
    }
  }

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
            backend, the design handover for UX, the incident write-up for everybody. Write it once
            here instead of saying it once per hire.
          </EmptyState>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              {/* One control, above both halves: it decides whose board is being discussed. */}
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
                                    {all.find((other) => other.id === blueprint.afterId)?.title ??
                                      "a removed blueprint"}
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
                                onClick={() => void handleRemove(blueprint)}
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
                    Their board on day one — the stages it folds into, and the runs that stand as
                    one card.
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
