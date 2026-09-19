import { useEffect, useRef, useState } from "react";
import { Check, CornerDownRight, ListChecks, Pencil, Plus, Trash2, Users } from "lucide-react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { DrawerCard } from "../../admin/components/DrawerCard";
import { Field } from "../../../components/ui/Field";
import { InfoHint } from "../../../components/ui/InfoHint";
import { Input } from "../../../components/ui/Input";
import { Spinner } from "../../../components/ui/Spinner";
import { Textarea } from "../../../components/ui/Textarea";
import { useToast } from "../../../context/useToast";
import { useArrivalAuthoring } from "../hooks/useArrivalAuthoring";
import { howStepGetsDone } from "../howItsDone";
import { mergedStepCount } from "../mergedSteps";
import { radioCardClassName } from "../radioCard";
import { AddArrivalStepModal } from "./AddArrivalStepModal";
import { ArrivalStepThread } from "./ArrivalStepThread";
import type { ArrivalScope, ArrivalStep, UpdateArrivalStepRequest } from "../types";

/**
 * A one-shot instruction for what to do right after landing on this tab, set by the Overview
 * tab's readiness checks. Consumed once — see `onFocusHandled`. Mirrors `StarterWorkFocus`.
 */
export type ArrivalFocus = "add";

/** Spells out every short badge word the thread and the edit drawer use, for the "What the badges
 * mean" hint next to the step count — the badges themselves stay terse on purpose. */
const BADGE_LEGEND =
  "Auto only: only SprintStart can check this, the hire can't tick it themselves. " +
  "Auto or tick: SprintStart checks it automatically, or the hire can tick it off themselves. " +
  "Self-tick: the hire ticks it off themselves, nothing is checked. " +
  "GitHub / First PR: tied to that specific check. " +
  "Override: a project's own version of a company step. " +
  "Overridden: the company step that override replaces.";

/**
 * Authoring both arrival lists at once — the company-wide list every new hire gets, and (when
 * there is a project in context) what that project adds on top.
 *
 * Both blocks render together rather than behind separate tabs, because the thing a PM actually
 * needs to see is how they combine: a project step that reuses a company step's key replaces its
 * wording in place, and that relationship only reads clearly with both lists on screen.
 *
 * Two kinds of step, recorded separately and never blended: one written here is settled by
 * the hire saying so, one taken from the catalog above is checked by the system. That is why the
 * board card counts them apart rather than showing one figure.
 *
 * Nothing is seeded, the checkable ones included.
 *
 * HR reads but does not write, matching the backend — `readOnly` strips every control down to the
 * list itself.
 */
export function ArrivalStepAuthoring({
  readOnly = false,
  projectId = null,
  projectName = null,
  focus = null,
  onFocusHandled,
}: {
  readOnly?: boolean;
  projectId?: string | null;
  projectName?: string | null;
  focus?: ArrivalFocus | null;
  /**
   * Called once `focus` has been acted on (or found to have nothing to act on), so the caller can
   * clear it. Without this, navigating away and back to the Arrival tab — or the section simply
   * re-rendering — would replay the same jump every time. Matches `StarterWorkSection`'s own.
   */
  onFocusHandled?: () => void;
}) {
  const {
    company,
    project,
    derivable,
    loading,
    error,
    writeError,
    create,
    addDerivable,
    update,
    move,
    reorder,
    remove,
  } = useArrivalAuthoring(projectId);

  const hasProject = projectId !== null;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // Held on the list rather than on the row: one dialog at a time, and the row that opened it may
  // be gone by the time the removal lands.
  const [confirming, setConfirming] = useState<{ step: ArrivalStep; scope: ArrivalScope } | null>(
    null,
  );
  const [editing, setEditing] = useState<{ step: ArrivalStep; scope: ArrivalScope } | null>(null);

  // A refused write is a toast, like every other refused write in the app — the list below is
  // still the list the server has, so the message belongs to the attempt rather than to the page.
  const toast = useToast();
  const showErrorToast = toast.error;
  const showSuccessToast = toast.success;

  useEffect(() => {
    if (!writeError) return;
    showErrorToast("That didn't save", { description: writeError });
  }, [writeError, showErrorToast]);

  // Consumes the Overview tab's one-shot jump exactly once, so revisiting this tab later never
  // replays it. Waits for the lists' own fetch first — opening the wizard while `loading` is still
  // true would hand it an empty derivable catalog. Never opens for a reader who cannot write.
  const focusHandled = useRef(false);
  useEffect(() => {
    if (!focus || focusHandled.current || loading || readOnly) return;

    focusHandled.current = true;
    // Deferred to a microtask, matching `StarterWorkSection`'s own focus effect — see
    // `react-hooks/set-state-in-effect`.
    void Promise.resolve().then(() => {
      if (focus === "add") setIsAddModalOpen(true);
      onFocusHandled?.();
    });
  }, [focus, loading, readOnly, onFocusHandled]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" label="Loading the arrival lists" />
      </div>
    );
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text"
      >
        The arrival lists could not be loaded. Refresh to try again.
      </p>
    );
  }

  const companySteps = company ?? [];
  const projectSteps = project ?? [];
  const companyKeys = new Set(companySteps.map((step) => step.key));
  const overriddenKeys = new Set(projectSteps.map((step) => step.key));
  const stepCount = mergedStepCount(company, project);
  const countLabel = hasProject
    ? `${stepCount} ${stepCount === 1 ? "step" : "steps"} for a new hire on ${
        projectName ?? "this project"
      }`
    : `${stepCount} ${stepCount === 1 ? "step" : "steps"} for every new hire`;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm text-app-text-muted">
          {countLabel}
          <InfoHint text={BADGE_LEGEND} label="What the badges mean" />
        </p>
        {!readOnly && (
          <Button
            variant="secondary"
            onClick={() => setIsAddModalOpen(true)}
            icon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Add step
          </Button>
        )}
      </div>

      <ArrivalStepThread
        companySteps={companySteps}
        projectSteps={projectSteps}
        hasProject={hasProject}
        projectName={projectName}
        readOnly={readOnly}
        onMove={(key, direction, scope) => void move(key, direction, scope)}
        onReorder={(orderedKeys, scope) => void reorder(orderedKeys, scope)}
        onEdit={(step, scope) => setEditing({ step, scope })}
      />

      {readOnly && (
        <p className="text-sm text-app-text-subtle">Only PMs and admins can change this list.</p>
      )}

      {isAddModalOpen && (
        <AddArrivalStepModal
          hasProject={hasProject}
          projectName={projectName}
          derivable={derivable}
          onAddDerivable={async (derivation) => {
            const ok = await addDerivable(derivation);
            if (ok) showSuccessToast("Step added");
            return ok;
          }}
          onCreate={async (request, who) => {
            const ok = await create(request, who);
            if (ok) showSuccessToast("Step added");
            return ok;
          }}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/*
              What a PM cannot guess is what survives. State is keyed by the step key, not by a row
              id, so removing this takes it off the list without destroying who already did it --
              and re-adding the same key brings those records back.
            */}
      <AlertDialog
        isOpen={confirming !== null}
        variant="danger"
        title={
          confirming
            ? confirming.scope === "company"
              ? `Remove “${confirming.step.title}” from everyone’s board?`
              : `Remove “${confirming.step.title}” from ${projectName ?? "this project"}’s board?`
            : "Remove this step?"
        }
        description={
          confirming ? (
            <p>
              Records of people who already did it are kept. Adding a step with the key{" "}
              <span className="font-mono">{confirming.step.key}</span> again restores them.
            </p>
          ) : undefined
        }
        confirmLabel="Remove"
        cancelLabel="Keep it"
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          const target = confirming;
          if (!target) return;
          void (async () => {
            if (await remove(target.step.key, target.scope)) setConfirming(null);
          })();
        }}
      />

      {editing &&
        (() => {
          const companyStep = companySteps.find((step) => step.key === editing.step.key);
          const isOverride = editing.scope === "project" && companyKeys.has(editing.step.key);
          const replacedForProject =
            editing.scope === "company" && hasProject && overriddenKeys.has(editing.step.key);
          const askScope = editing.scope === "company" && hasProject && !replacedForProject;

          return (
            <EditStepDrawer
              step={editing.step}
              scope={editing.scope}
              askScope={askScope}
              isOverride={isOverride}
              replacedForProject={replacedForProject}
              companyStepTitle={companyStep?.title}
              projectName={projectName}
              onClose={() => setEditing(null)}
              onSaveCompany={(request) => update(editing.step.key, request, "company")}
              onSaveProject={(request) => update(editing.step.key, request, "project")}
              onCreateOverride={(request) =>
                create({ key: editing.step.key, ...request }, "project")
              }
              onDelete={() => {
                setConfirming({ step: editing.step, scope: editing.scope });
                setEditing(null);
              }}
              onRevert={
                isOverride
                  ? () => {
                      void (async () => {
                        if (await remove(editing.step.key, "project")) {
                          setEditing(null);
                          showSuccessToast(
                            "Company wording restored",
                            projectName
                              ? {
                                  description: `People on ${projectName} see the step everyone gets.`,
                                }
                              : undefined,
                          );
                        }
                      })();
                    }
                  : undefined
              }
            />
          );
        })()}
    </section>
  );
}

function EditStepDrawer({
  step,
  scope,
  askScope,
  isOverride,
  replacedForProject,
  companyStepTitle,
  projectName,
  onClose,
  onSaveCompany,
  onSaveProject,
  onCreateOverride,
  onDelete,
  onRevert,
}: {
  step: ArrivalStep;
  scope: ArrivalScope;
  /** Whether to ask "everyone vs only this project" before saving. */
  askScope: boolean;
  /** A project step that shadows a company step of the same key. */
  isOverride: boolean;
  /** A company step, seen from a project view, that a project override already shadows. */
  replacedForProject: boolean;
  companyStepTitle?: string;
  projectName: string | null;
  onClose: () => void;
  onSaveCompany: (request: UpdateArrivalStepRequest) => Promise<boolean>;
  onSaveProject: (request: UpdateArrivalStepRequest) => Promise<boolean>;
  onCreateOverride: (request: {
    title: string;
    description?: string;
    href?: string;
  }) => Promise<boolean>;
  onDelete: () => void;
  onRevert?: () => void;
}) {
  const [title, setTitle] = useState(step.title);
  const [description, setDescription] = useState(step.description ?? "");
  const [href, setHref] = useState(step.href ?? "");
  // Defaults to "only this project": the reader is looking at this project's list, so that is
  // the least surprising place for their change to land.
  const [answer, setAnswer] = useState<ArrivalScope>("project");
  const [saving, setSaving] = useState(false);

  const howItsDone = howStepGetsDone(step);
  const HowItsDoneIcon = howItsDone.icon;

  const handleSave = async () => {
    setSaving(true);
    try {
      const trimmedTitle = title.trim();
      const trimmedDescription = description.trim();
      const trimmedHref = href.trim();

      let ok: boolean;
      if (askScope && answer === "project") {
        ok = await onCreateOverride({
          title: trimmedTitle,
          description: trimmedDescription || undefined,
          href: trimmedHref || undefined,
        });
      } else {
        const request: UpdateArrivalStepRequest = {
          title: trimmedTitle,
          description: trimmedDescription || null,
          href: trimmedHref || null,
        };
        ok = scope === "project" ? await onSaveProject(request) : await onSaveCompany(request);
      }
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailsSideDrawer
      isOpen
      onClose={onClose}
      showOverlay
      title="Edit step"
      leading={
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-app-border bg-app-surface-muted text-app-text-muted">
          <Pencil className="h-6 w-6" aria-hidden="true" />
        </div>
      }
      badge={
        <>
          {isOverride && (
            <Badge
              variant="brand"
              size="md"
              className="gap-1"
              title="Replaces the company-wide wording for this project."
            >
              <CornerDownRight className="h-3 w-3" aria-hidden="true" />
              Override
            </Badge>
          )}
          <Badge
            variant={step.settledBy === "OBSERVED" ? "success" : "neutral"}
            size="md"
            className="gap-1"
            title={howItsDone.label}
          >
            <HowItsDoneIcon className="h-3 w-3" aria-hidden="true" />
            {howItsDone.badge}
          </Badge>
        </>
      }
      footer={
        <div className="flex w-full gap-2">
          {!isOverride && (
            <Button
              variant="dangerGhost"
              onClick={onDelete}
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            >
              Remove step
            </Button>
          )}
          <Button
            variant="primary"
            className="ml-auto"
            loading={saving}
            onClick={() => void handleSave()}
            icon={<Check className="h-4 w-4" aria-hidden="true" />}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4 sm:space-y-5">
        {replacedForProject && (
          <DrawerCard label="Replaced here" icon={CornerDownRight} index={0}>
            <p className="text-sm text-app-text-muted">
              People on {projectName ?? "this project"} see their own version of this step. Changes
              here only reach everyone else.
            </p>
          </DrawerCard>
        )}

        {askScope && (
          <DrawerCard label="Who does this apply to" icon={Users} index={0}>
            <p className="mb-3 text-sm text-app-text-muted">
              Everyone gets this step. Where should your change apply?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={answer === "company"}
                aria-label="Everyone"
                onClick={() => setAnswer("company")}
                className={radioCardClassName(answer === "company")}
              >
                <span className="block text-sm font-semibold text-app-text">Everyone</span>
                <span className="block text-xs text-app-text-muted">
                  Changes the wording for all projects.
                </span>
              </button>
              <button
                type="button"
                aria-pressed={answer === "project"}
                aria-label={`Only ${projectName ?? "this project"}`}
                onClick={() => setAnswer("project")}
                className={radioCardClassName(answer === "project")}
              >
                <span className="block text-sm font-semibold text-app-text">
                  Only {projectName ?? "this project"}
                </span>
                <span className="block text-xs text-app-text-muted">
                  Everyone else keeps the original. Nobody loses what they already ticked.
                </span>
              </button>
            </div>
          </DrawerCard>
        )}

        {isOverride && (
          <DrawerCard label="Replaces the company wording" icon={CornerDownRight} index={1}>
            <p className="text-sm text-app-text-muted">
              &ldquo;{companyStepTitle}&rdquo; is what everyone else sees. Hires who already did it
              keep that.
            </p>
            {onRevert && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={onRevert}>
                Use the company wording again
              </Button>
            )}
          </DrawerCard>
        )}

        <DrawerCard label="Step" icon={ListChecks} index={2}>
          <div className="space-y-4">
            <Field label="What needs to be done">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="How to do it">
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                minRows={2}
              />
            </Field>
            <Field label="Where to do it">
              <Input
                value={href}
                onChange={(event) => setHref(event.target.value)}
                placeholder="https://…"
              />
            </Field>
          </div>
        </DrawerCard>

        <DrawerCard label="How it settles" icon={HowItsDoneIcon} index={3}>
          <p className="text-sm text-app-text-muted">{howItsDone.label}</p>
        </DrawerCard>

        <p className="font-mono text-xs text-app-text-subtle">
          key: {step.key} · fixed, what hires ticked is stored against it
        </p>
      </div>
    </DetailsSideDrawer>
  );
}
