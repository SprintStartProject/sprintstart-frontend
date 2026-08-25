import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Eye, Plus, Trash2 } from "lucide-react";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { Spinner } from "../../../components/ui/Spinner";
import { useToast } from "../../../context/useToast";
import { useArrivalAuthoring } from "../hooks/useArrivalAuthoring";
import type { ArrivalStep, DerivableArrivalStep } from "../types";

/**
 * Authoring the company-wide arrival list — the things a new joiner has to get done before they can
 * work.
 *
 * This list orders attention; it gates nothing. An outstanding step is shown to the hire
 * and raised by their buddy, and that is the whole of its effect.
 *
 * Two kinds of step, recorded separately and never blended: one written here is settled by
 * the hire saying so, one taken from the catalog below is checked by the system. That is why the
 * board card counts them apart rather than showing one figure.
 *
 * Nothing is seeded, the checkable ones included.
 *
 * Every control here is a shared primitive — `Button`, `Field`/`Input`, `EmptyState`, `Badge` — and
 * the removal goes through the app's one `AlertDialog` rather than an inline confirm of its own, so
 * a destructive step here behaves exactly like a destructive step anywhere else in the app.
 */
export function ArrivalStepAuthoring({
  readOnly = false,
  projectId = null,
  projectName = null,
}: {
  readOnly?: boolean;
  /** The scope being authored. Null means company-wide, as everywhere else in this model. */
  projectId?: string | null;
  projectName?: string | null;
}) {
  const { steps, derivable, loading, error, writeError, create, addDerivable, move, remove } =
    useArrivalAuthoring(projectId);
  const [adding, setAdding] = useState(false);
  // Held on the list rather than on the row: one dialog at a time, and the row that opened it may
  // be gone by the time the removal lands.
  const [confirming, setConfirming] = useState<ArrivalStep | null>(null);

  // A refused write is a toast, like every other refused write in the app — the list below is
  // still the list the server has, so the message belongs to the attempt rather than to the page.
  const toast = useToast();
  const showErrorToast = toast.error;

  useEffect(() => {
    if (!writeError) return;
    showErrorToast("That didn't save", { description: writeError });
  }, [writeError, showErrorToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" label="Loading the arrival list" />
      </div>
    );
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text"
      >
        The arrival list could not be loaded. Refresh to try again.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-app-text">
          {projectName ? `Arrival steps for ${projectName}` : "Arrival steps"}
        </h2>
        <p className="max-w-2xl text-sm text-app-text-muted">
          {projectName ? (
            <>
              Extra steps for people on{" "}
              <strong className="font-medium text-app-text">{projectName}</strong>, on top of the
              company-wide list. A step here that reuses a company step&apos;s key replaces its
              wording without losing anyone&apos;s record of having done it.
            </>
          ) : (
            <>
              What somebody needs before they can start — accounts, access, a machine that builds.
              These appear on every new joiner&apos;s board, whichever project they are on.
            </>
          )}{" "}
          <strong className="font-medium text-app-text">Nothing here blocks anyone</strong>: an
          outstanding step is shown and raised by their buddy, never enforced.
        </p>
      </header>

      {steps && steps.length === 0 ? (
        <EmptyState size="sm">
          {projectName
            ? `No steps specific to ${projectName}. People here still get the ` +
              "company-wide list — add something only if this project needs it on top."
            : "No arrival steps yet, so nobody sees this card at all. Add the first " +
              "thing a new joiner has to do before they can work."}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {steps?.map((step, index) => (
            <StepRow
              key={step.key}
              step={step}
              readOnly={readOnly}
              canMoveUp={index > 0}
              canMoveDown={index < steps.length - 1}
              onMove={move}
              onRequestRemove={setConfirming}
            />
          ))}
        </ul>
      )}

      {readOnly ? (
        <EmptyState size="sm">
          You can see this list but not change it — a PM or an admin can. If something here is wrong
          or missing, that is who to tell.
        </EmptyState>
      ) : adding ? (
        <AddStepForm
          onCancel={() => setAdding(false)}
          onCreate={async (request) => {
            if (await create(request)) setAdding(false);
          }}
        />
      ) : (
        <Button
          variant="secondary"
          onClick={() => setAdding(true)}
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          Add a step
        </Button>
      )}

      {/*
              Company scope only. A derivation is code bound to one key, so a checkable step is the
              same step everywhere and belongs on the list everybody gets — and the catalog's
              `added` flags describe that list, so in a project scope they would advertise as
              available something already on the company list.
            */}
      {projectId === null && (
        <DerivableCatalog derivable={derivable} readOnly={readOnly} onAdd={addDerivable} />
      )}

      {/*
              What a PM cannot guess is what survives. State is keyed by the step key, not by a row
              id, so removing this takes it off everyone's board without destroying who already did
              it -- and re-adding the same key brings those records back.
            */}
      <AlertDialog
        isOpen={confirming !== null}
        variant="danger"
        title={
          confirming
            ? `Remove “${confirming.title}” from everyone’s board?`
            : "Remove this step from everyone’s board?"
        }
        description={
          confirming ? (
            <p>
              Records of people who already did it are kept. Adding a step with the key{" "}
              <span className="font-mono">{confirming.key}</span> again restores them.
            </p>
          ) : undefined
        }
        confirmLabel="Remove"
        cancelLabel="Keep it"
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          const step = confirming;
          if (!step) return;
          void (async () => {
            if (await remove(step.key)) setConfirming(null);
          })();
        }}
      />
    </section>
  );
}

/**
 * The steps the system can check for itself, offered by name.
 *
 * The backend binds a step to its derivation by its key, so typing one of these into the form
 * above silently produces a derived step. This is the discoverable way to add them.
 *
 * Shown to a read-only reader too, without buttons.
 */
function DerivableCatalog({
  derivable,
  readOnly,
  onAdd,
}: {
  derivable: DerivableArrivalStep[];
  readOnly: boolean;
  onAdd: (derivation: DerivableArrivalStep) => Promise<boolean>;
}) {
  if (derivable.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-2xl border border-dashed border-app-border p-4">
      <header className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-app-text">
          <Eye className="h-4 w-4 text-app-text-muted" aria-hidden="true" />
          Steps we can check ourselves
        </h3>
        <p className="text-xs text-app-text-muted">
          These settle when the system sees them done, rather than when somebody ticks them —
          recorded separately from anybody&apos;s word for it. Add the ones that apply to your
          organisation; none are added for you.
        </p>
      </header>

      <ul className="space-y-2">
        {derivable.map((derivation) => (
          <li
            key={derivation.key}
            className="flex items-start justify-between gap-3 rounded-xl border border-app-border bg-app-surface p-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-app-text">{derivation.suggestedTitle}</p>
              <p className="mt-1 text-xs text-app-text-muted">{derivation.suggestedDescription}</p>
              {/*
                              Said before adding, not discovered afterwards: whether the hire can
                              also claim it is fixed by the derivation and cannot be edited later,
                              unlike the wording.
                            */}
              <p className="mt-1 text-xs text-app-text-muted">
                {derivation.selfConfirmable
                  ? "The hire can also mark this done themselves."
                  : "Only the check settles this — the hire cannot mark it done."}
              </p>
            </div>

            {derivation.added ? (
              <Badge variant="neutral" size="sm" className="shrink-0">
                On the list
              </Badge>
            ) : (
              !readOnly && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void onAdd(derivation)}
                >
                  Add
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StepRow({
  step,
  readOnly,
  canMoveUp,
  canMoveDown,
  onMove,
  onRequestRemove,
}: {
  step: ArrivalStep;
  readOnly: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (key: string, direction: "up" | "down") => Promise<boolean>;
  onRequestRemove: (step: ArrivalStep) => void;
}) {
  return (
    <li className="rounded-2xl border border-app-border bg-app-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-app-text">{step.title}</p>
          {step.description && (
            <p className="mt-1 text-xs text-app-text-muted">{step.description}</p>
          )}
          <p className="mt-1 font-mono text-xs text-app-text-subtle">{step.key}</p>
          {/*
                      Which steps the system checks is not visible from their wording, and it is the
                      difference between a list somebody has to work through and one that partly
                      settles itself. Said on the row rather than only in the catalog below, since
                      that is where the list is actually read.
                    */}
          {step.settledBy === "OBSERVED" && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-app-text-muted">
              <Eye className="h-3 w-3" aria-hidden="true" />
              We check this one
              {!step.selfConfirmable && " — the hire cannot mark it done"}
            </p>
          )}
        </div>

        {/*
                  Not rendered at all rather than hidden with a class: a control that only CSS keeps
                  out of reach is still focusable, still in the accessibility tree, and still there
                  if a stylesheet fails to load.
                */}
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => void onMove(step.key, "up")}
              disabled={!canMoveUp}
              aria-label={`Move "${step.title}" earlier`}
            >
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => void onMove(step.key, "down")}
              disabled={!canMoveDown}
              aria-label={`Move "${step.title}" later`}
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="dangerGhost"
              size="sm"
              iconOnly
              onClick={() => onRequestRemove(step)}
              aria-label={`Remove "${step.title}"`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function AddStepForm({
  onCreate,
  onCancel,
}: {
  onCreate: (request: {
    key: string;
    title: string;
    description?: string;
    href?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [key, setKey] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [href, setHref] = useState("");

  const canSubmit = key.trim().length > 0 && title.trim().length > 0;

  return (
    <form
      className="space-y-3 rounded-2xl border border-app-border bg-app-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        void onCreate({
          key: key.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
          href: href.trim() || undefined,
        });
      }}
    >
      <Field label="Title" hint="What the person has to do, in their words.">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Request VPN access"
        />
      </Field>

      {/* The key is immutable because state points at it; saying so at the point of
                choosing is cheaper than explaining it after somebody wants to change one. */}
      <Field
        label="Key"
        hint="A short id, fixed once saved — it is what people's records point at."
      >
        <Input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="vpn-access"
        />
      </Field>

      <Field label="Description" hint="Optional. Anything they need to know before starting.">
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Ask in #it-helpdesk; usually same-day."
        />
      </Field>

      <Field label="Link" hint="Optional. Where to go to actually do it.">
        <Input
          value={href}
          onChange={(event) => setHref(event.target.value)}
          placeholder="https://…"
        />
      </Field>

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
