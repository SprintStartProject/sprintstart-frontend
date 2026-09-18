import { useEffect, useState, type ReactNode } from "react";
import { Check, Eye, Pencil, Plus } from "lucide-react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Button } from "../../../components/ui/Button";
import { DetailsSideDrawer } from "../../../components/layout/DetailsSideDrawer";
import { DrawerCard } from "../../admin/components/DrawerCard";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { Spinner } from "../../../components/ui/Spinner";
import { Textarea } from "../../../components/ui/Textarea";
import { useToast } from "../../../context/useToast";
import { useArrivalAuthoring } from "../hooks/useArrivalAuthoring";
import { howStepGetsDone } from "../howItsDone";
import { slugifyStepKey } from "../slug";
import { ArrivalStepThread } from "./ArrivalStepThread";
import type {
  ArrivalScope,
  ArrivalStep,
  DerivableArrivalStep,
  UpdateArrivalStepRequest,
} from "../types";

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
  actions = null,
}: {
  readOnly?: boolean;
  projectId?: string | null;
  projectName?: string | null;
  /** Rendered in the toolbar row, to the right of "Add a step". */
  actions?: ReactNode;
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

  const [adding, setAdding] = useState(false);
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
  // A step a project overrides is still one entry on the hire's list, not two — it is a
  // replacement, not an addition. Same calculation as the Overview tab's Arrive card.
  const mergedStepCount =
    companySteps.filter((step) => !overriddenKeys.has(step.key)).length + projectSteps.length;
  const countLabel = hasProject
    ? `${mergedStepCount} ${mergedStepCount === 1 ? "step" : "steps"} for a new hire on ${
        projectName ?? "this project"
      }`
    : `${mergedStepCount} ${mergedStepCount === 1 ? "step" : "steps"} for every new hire`;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-app-text-muted">{countLabel}</p>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && !adding && (
            <Button
              variant="secondary"
              onClick={() => setAdding(true)}
              icon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              Add a step
            </Button>
          )}
          {actions}
        </div>
      </div>

      <SuggestionChips derivable={derivable} readOnly={readOnly} onAdd={addDerivable} />

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

      {readOnly ? (
        <p className="text-sm text-app-text-subtle">Only PMs and admins can change this list.</p>
      ) : (
        adding && (
          <AddStepForm
            hasProject={hasProject}
            projectName={projectName}
            defaultWho={hasProject ? "project" : "company"}
            onCancel={() => setAdding(false)}
            onCreate={async (request, who) => {
              if (await create(request, who)) setAdding(false);
            }}
          />
        )
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

function radioCardClassName(active: boolean): string {
  return `rounded-xl border p-3 text-left transition-colors ${
    active
      ? "border-app-brand bg-app-brand-soft ring-2 ring-app-brand-glow"
      : "border-app-border bg-app-bg hover:border-app-border-strong"
  }`;
}

/**
 * The steps the system can check for itself, offered by name, as chips rather than a boxed
 * catalog — the backend binds a step to its derivation by its key, so tapping one silently
 * produces a derived step. This is the discoverable way to add one.
 *
 * Always company-wide: a derivation is code, so the same key can only be derived once, and
 * `added` here always describes the company-wide list regardless of which block is showing.
 */
function SuggestionChips({
  derivable,
  readOnly,
  onAdd,
}: {
  derivable: DerivableArrivalStep[];
  readOnly: boolean;
  onAdd: (derivation: DerivableArrivalStep) => Promise<boolean>;
}) {
  if (derivable.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-app-text-subtle">
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        We can check these ourselves:
      </span>
      {derivable.map((derivation) =>
        derivation.added ? (
          <span
            key={derivation.key}
            title={derivation.suggestedDescription}
            className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-surface px-3 py-1.5 text-xs font-medium text-app-text-subtle"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {derivation.suggestedTitle}
          </span>
        ) : readOnly ? (
          <span
            key={derivation.key}
            title={derivation.suggestedDescription}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-app-brand-border bg-app-brand-soft px-3 py-1.5 text-xs font-medium text-app-brand-text"
          >
            {derivation.suggestedTitle}
          </span>
        ) : (
          <button
            key={derivation.key}
            type="button"
            title={derivation.suggestedDescription}
            onClick={() => void onAdd(derivation)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-app-brand-border bg-app-brand-soft px-3 py-1.5 text-xs font-medium text-app-brand-text transition-colors hover:border-solid"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {derivation.suggestedTitle}
          </button>
        ),
      )}
    </div>
  );
}

function AddStepForm({
  hasProject,
  projectName,
  defaultWho,
  onCreate,
  onCancel,
}: {
  hasProject: boolean;
  projectName: string | null;
  defaultWho: ArrivalScope;
  onCreate: (
    request: { key: string; title: string; description?: string; href?: string },
    who: ArrivalScope,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [href, setHref] = useState("");
  // `null` while the key follows the title; set the moment somebody types into the key field
  // themselves, so a later title edit does not overwrite what they just chose.
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [who, setWho] = useState<ArrivalScope>(defaultWho);

  const key = manualKey ?? slugifyStepKey(title);
  const canSubmit = key.trim().length > 0 && title.trim().length > 0;

  return (
    <form
      className="space-y-3 rounded-2xl border border-app-border bg-app-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        void onCreate(
          {
            key: key.trim(),
            title: title.trim(),
            description: description.trim() || undefined,
            href: href.trim() || undefined,
          },
          hasProject ? who : "company",
        );
      }}
    >
      <Field label="What needs to be done">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Request VPN access"
        />
      </Field>

      <Field label="How to do it" hint="Optional. Anything they need to know before starting.">
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          minRows={2}
          placeholder="Ask in #it-helpdesk; usually same-day."
        />
      </Field>

      <Field label="Where to do it" hint="Optional link.">
        <Input
          value={href}
          onChange={(event) => setHref(event.target.value)}
          placeholder="https://…"
        />
      </Field>

      {hasProject && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-app-text">Who gets it</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={who === "project"}
              aria-label={projectName ?? "This project"}
              onClick={() => setWho("project")}
              className={radioCardClassName(who === "project")}
            >
              <span className="block text-sm font-semibold text-app-text">
                {projectName ?? "This project"}
              </span>
              <span className="block text-xs text-app-text-muted">
                Only people on this project.
              </span>
            </button>
            <button
              type="button"
              aria-pressed={who === "company"}
              aria-label="Everyone"
              onClick={() => setWho("company")}
              className={radioCardClassName(who === "company")}
            >
              <span className="block text-sm font-semibold text-app-text">Everyone</span>
              <span className="block text-xs text-app-text-muted">
                Every new hire, any project.
              </span>
            </button>
          </div>
        </fieldset>
      )}

      <details className="text-xs text-app-text-subtle">
        <summary className="cursor-pointer font-medium">Advanced</summary>
        <div className="mt-2">
          <Field
            label="Key"
            hint="A short id, fixed once saved — it is what people's records point at."
          >
            <Input
              value={key}
              onChange={(event) => setManualKey(event.target.value)}
              placeholder="vpn-access"
            />
          </Field>
        </div>
      </details>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          Add step
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
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
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-app-brand-soft text-app-brand-text">
          <Pencil className="h-5 w-5" aria-hidden="true" />
        </span>
      }
      footer={
        <div className="flex w-full gap-2">
          {!isOverride && (
            <Button variant="dangerGhost" onClick={onDelete}>
              Remove step
            </Button>
          )}
          <Button
            variant="primary"
            className="ml-auto"
            loading={saving}
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {replacedForProject && (
          <DrawerCard index={0}>
            <p className="text-sm text-app-text-muted">
              People on {projectName ?? "this project"} see their own version of this step. Changes
              here only reach everyone else.
            </p>
          </DrawerCard>
        )}

        {askScope && (
          <DrawerCard index={0}>
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
          <DrawerCard label="Replaces the company wording" index={1}>
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

        <div className="flex items-center gap-1.5 rounded-xl border border-app-border bg-app-surface-muted p-3 text-xs text-app-text-muted">
          <HowItsDoneIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {howItsDone.label}
        </div>

        <p className="font-mono text-xs text-app-text-subtle">
          key: {step.key} · fixed, what hires ticked is stored against it
        </p>
      </div>
    </DetailsSideDrawer>
  );
}
