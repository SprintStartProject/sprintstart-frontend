import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, Trash2 } from "lucide-react";
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

  if (loading) {
    return <p className="text-sm text-app-text-muted">Loading the arrival list…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-app-danger-text">
        The arrival list could not be loaded. Refresh to try again.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-medium text-app-text">
          {projectName ? `Arrival steps for ${projectName}` : "Arrival steps"}
        </h2>
        <p className="text-sm text-app-text-muted">
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

      {writeError && <p className="text-sm text-app-danger-text">{writeError}</p>}

      {steps && steps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-app-border p-4 text-sm text-app-text-muted">
          {projectName
            ? `No steps specific to ${projectName}. People here still get the ` +
              "company-wide list — add something only if this project needs it on top."
            : "No arrival steps yet, so nobody sees this card at all. Add the first " +
              "thing a new joiner has to do before they can work."}
        </p>
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
              onRemove={remove}
            />
          ))}
        </ul>
      )}

      {readOnly ? (
        <p className="rounded-xl border border-dashed border-app-border p-4 text-sm text-app-text-muted">
          You can see this list but not change it — a PM or an admin can. If something here is wrong
          or missing, that is who to tell.
        </p>
      ) : adding ? (
        <AddStepForm
          onCancel={() => setAdding(false)}
          onCreate={async (request) => {
            if (await create(request)) setAdding(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-lg border border-app-border px-3 py-2 text-sm text-app-text transition hover:bg-app-surface-muted"
        >
          Add a step
        </button>
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
    <section className="space-y-3 rounded-xl border border-dashed border-app-border p-4">
      <header className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-medium text-app-text">
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
            className="flex items-start justify-between gap-3 rounded-lg border border-app-border p-3"
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
              <span className="shrink-0 text-xs text-app-text-muted">On the list</span>
            ) : (
              !readOnly && (
                <button
                  type="button"
                  onClick={() => void onAdd(derivation)}
                  className="shrink-0 rounded-lg border border-app-border px-2 py-1 text-xs text-app-text transition hover:bg-app-surface-muted"
                >
                  Add
                </button>
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
  onRemove,
}: {
  step: ArrivalStep;
  readOnly: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (key: string, direction: "up" | "down") => Promise<boolean>;
  onRemove: (key: string) => Promise<boolean>;
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  return (
    <li className="rounded-xl border border-app-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-app-text">{step.title}</p>
          {step.description && (
            <p className="mt-1 text-xs text-app-text-muted">{step.description}</p>
          )}
          <p className="mt-1 font-mono text-xs text-app-text-muted">{step.key}</p>
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
            <button
              type="button"
              onClick={() => void onMove(step.key, "up")}
              disabled={!canMoveUp}
              aria-label={`Move "${step.title}" earlier`}
              className="rounded-lg p-1 text-app-text-muted transition hover:bg-app-surface-muted disabled:opacity-40"
            >
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void onMove(step.key, "down")}
              disabled={!canMoveDown}
              aria-label={`Move "${step.title}" later`}
              className="rounded-lg p-1 text-app-text-muted transition hover:bg-app-surface-muted disabled:opacity-40"
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              aria-label={`Remove "${step.title}"`}
              className="rounded-lg p-1 text-app-text-muted transition hover:bg-app-surface-muted"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {confirmingRemove && (
        <div className="mt-3 rounded-lg border border-app-border bg-app-surface-muted/40 p-3">
          {/*
                      What a PM cannot guess is what survives. State is keyed by the step key, not by
                      a row id, so removing this takes it off everyone's board without destroying who
                      already did it -- and re-adding the same key brings those records back.
                    */}
          <p className="text-sm text-app-text">
            Remove &ldquo;{step.title}&rdquo; from everyone&apos;s board?
          </p>
          <p className="mt-1 text-xs text-app-text-muted">
            Records of people who already did it are kept. Adding a step with the key{" "}
            <span className="font-mono">{step.key}</span> again restores them.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void onRemove(step.key)}
              className="rounded-lg border border-app-danger-border px-2 py-1 text-xs text-app-danger-text transition hover:bg-app-danger-bg/30"
            >
              Remove
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
              className="rounded-lg border border-app-border px-2 py-1 text-xs text-app-text transition hover:bg-app-surface-muted"
            >
              Keep it
            </button>
          </div>
        </div>
      )}
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
      className="space-y-3 rounded-xl border border-app-border p-4"
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
      <Field
        label="Title"
        hint="What the person has to do, in their words."
        value={title}
        onChange={setTitle}
        placeholder="Request VPN access"
      />
      <Field
        label="Key"
        // The key is immutable because state points at it; saying so at the point of
        // choosing is cheaper than explaining it after somebody wants to change one.
        hint="A short id, fixed once saved — it is what people's records point at."
        value={key}
        onChange={setKey}
        placeholder="vpn-access"
      />
      <Field
        label="Description"
        hint="Optional. Anything they need to know before starting."
        value={description}
        onChange={setDescription}
        placeholder="Ask in #it-helpdesk; usually same-day."
      />
      <Field
        label="Link"
        hint="Optional. Where to go to actually do it."
        value={href}
        onChange={setHref}
        placeholder="https://…"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg border border-app-border bg-app-brand px-3 py-2 text-sm text-white transition hover:bg-app-brand-hover disabled:opacity-60"
        >
          Add step
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-app-border px-3 py-2 text-sm text-app-text transition hover:bg-app-surface-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-app-text">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text placeholder:text-app-text-muted"
      />
      <span className="block text-xs text-app-text-muted">{hint}</span>
    </label>
  );
}
