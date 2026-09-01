import { useCallback, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ClipboardList, Lock, Pencil, Plus, Trash2, Users } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { FilterSelect, type FilterSelectOption } from "../components/ui/FilterSelect";
import { SpotlightCard } from "../components/ui/SpotlightCard";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../context/useToast";
import { useFetch } from "../hooks/useFetch";
import { STAGE_LABELS } from "../features/board/layout/boardStructure";
import { CardBlueprintEditor } from "../features/card-blueprints/components/CardBlueprintEditor";
import { cardBlueprintService } from "../features/card-blueprints/cardBlueprintService";
import {
  blueprintsForRoles,
  EMPTY_DRAFT,
  type CardBlueprint,
  type CardBlueprintDraft,
} from "../features/card-blueprints/types";
import { useProjectContext } from "../features/projects/useProjectContext";
import { getProjectRoles } from "../services/teamManagementService";

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
 * changed by opening it. What a blueprint produces is a card on the boards of the people whose
 * roles match it, in the stage it names, waiting on whatever it says it waits on.
 *
 * **The preview is the point of the right-hand column.** A PM cannot check a set of blueprints by
 * reading them — the question is always "what does a new backend hire actually get", and answering
 * it by hiring somebody is a slow feedback loop. Picking a role here answers it immediately.
 *
 * Scoped to the globally selected project, like every other PM surface, and reachable by the same
 * audience as the PM dashboard.
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

  /** The role the preview is answering for; empty is "a hire with no role in particular". */
  const [previewRoleId, setPreviewRoleId] = useState("");

  const roleOptions: FilterSelectOption<string>[] = [
    { value: "", label: "A hire with no role set" },
    ...projectRoles.map((role) => ({ value: role.id, label: role.name })),
  ];

  const preview = useMemo(
    () => blueprintsForRoles(all, previewRoleId ? [previewRoleId] : []),
    [all, previewRoleId],
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

  async function move(index: number, direction: "up" | "down") {
    if (!selectedProjectId) return;

    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= all.length) return;

    const ids = all.map((blueprint) => blueprint.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await cardBlueprintService.reorder(selectedProjectId, ids);
    reload();
  }

  const roleName = (roleId: string) =>
    projectRoles.find((role) => role.id === roleId)?.name ?? "Unknown role";

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
          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              {all.length === 0 ? (
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
                all.map((blueprint, index) => (
                  <SpotlightCard key={blueprint.id} roundedClassName="rounded-2xl">
                    <article className="flex items-start gap-3 p-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-semibold text-app-text">{blueprint.title}</h2>

                          <Badge
                            variant={blueprint.stage === "NOW" ? "brand" : "neutral"}
                            size="sm"
                          >
                            {STAGE_LABELS[blueprint.stage].title}
                          </Badge>

                          {blueprint.items.length > 0 && (
                            <Badge variant="neutral" size="sm">
                              {blueprint.items.length}{" "}
                              {blueprint.items.length === 1 ? "line" : "lines"}
                            </Badge>
                          )}

                          {blueprint.afterId && (
                            <Badge variant="neutral" size="sm" className="gap-1">
                              <Lock className="h-3 w-3" aria-hidden="true" />
                              After:{" "}
                              {all.find((other) => other.id === blueprint.afterId)?.title ??
                                "a removed blueprint"}
                            </Badge>
                          )}
                        </div>

                        {blueprint.description && (
                          <p className="text-sm text-app-text-muted">{blueprint.description}</p>
                        )}

                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-app-text-muted">
                          <Users className="h-3.5 w-3.5" aria-hidden="true" />
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
                          onClick={() => void move(index, "up")}
                          disabled={index === 0}
                          aria-label={`Move "${blueprint.title}" earlier`}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          onClick={() => void move(index, "down")}
                          disabled={index === all.length - 1}
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
                ))
              )}
            </div>

            <SpotlightCard roundedClassName="rounded-2xl">
              <section className="space-y-3 p-4">
                <div>
                  <h2 className="text-sm font-semibold text-app-text">What a new hire gets</h2>
                  <p className="text-xs text-app-text-muted">
                    The cards this role would find on their board on day one, in order.
                  </p>
                </div>

                <FilterSelect
                  label="Role to preview"
                  value={previewRoleId}
                  options={roleOptions}
                  onChange={setPreviewRoleId}
                />

                {preview.length === 0 ? (
                  <EmptyState size="sm">
                    Nothing yet — a blueprint with no roles ticked would reach this hire.
                  </EmptyState>
                ) : (
                  <ol className="space-y-1.5">
                    {preview.map((blueprint, index) => (
                      <li key={blueprint.id} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 w-5 shrink-0 text-xs text-app-text-subtle tabular-nums">
                          {index + 1}.
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-app-text">{blueprint.title}</span>
                          <span className="text-xs text-app-text-muted">
                            {STAGE_LABELS[blueprint.stage].title}
                            {blueprint.items.length > 0 && ` · ${blueprint.items.length} to tick`}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </SpotlightCard>
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
