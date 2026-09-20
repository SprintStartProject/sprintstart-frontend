import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  FolderKanban,
  KeyRound,
  PenLine,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Stepper } from "../../../components/ui/Stepper";
import { Textarea } from "../../../components/ui/Textarea";
import { howStepGetsDone } from "../howItsDone";
import { radioCardClassName } from "../radioCard";
import { slugifyStepKey } from "../slug";
import type { ArrivalScope, DerivableArrivalStep } from "../types";

const STEP_LABELS = ["Kind", "Details"];

type Kind = "suggested" | "custom";

type AddArrivalStepModalProps = {
  hasProject: boolean;
  projectName: string | null;
  derivable: DerivableArrivalStep[];
  /** The keys each list already holds, so a custom key that would collide is caught here rather
   * than coming back as a server 409. A key reused across the two lists is not a collision — that
   * is how a project overrides a company step — so the two are checked separately. */
  existingKeys: Record<ArrivalScope, string[]>;
  onAddDerivable: (derivation: DerivableArrivalStep) => Promise<boolean>;
  onCreate: (
    request: { key: string; title: string; description?: string; href?: string },
    who: ArrivalScope,
  ) => Promise<boolean>;
  onClose: () => void;
};

/**
 * "Add step" as a two-step wizard: pick a kind first, then either choose one of the steps
 * SprintStart can check for itself or write a custom one. Splitting it this way keeps the
 * common case — picking a suggestion — down to two taps, instead of a form that asks for a
 * title and a key before a reader even knows the suggestion existed. Picking a kind advances
 * immediately, the same way the create-project wizard's own type pickers do.
 *
 * Only ever mounted while open, so nothing here needs to reset itself on close — a fresh mount
 * starts clean the next time it opens.
 */
export function AddArrivalStepModal({
  hasProject,
  projectName,
  derivable,
  existingKeys,
  onAddDerivable,
  onCreate,
  onClose,
}: AddArrivalStepModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<"kind" | "details">("kind");
  const [kind, setKind] = useState<Kind | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [href, setHref] = useState("");
  // `null` while the key follows the title; set the moment somebody types into the key field
  // themselves, so a later title edit does not overwrite what they just chose.
  const [manualKey, setManualKey] = useState<string | null>(null);
  // Defaults to the project: the reader opened this from that project's list, so that is the
  // least surprising place for a new step to land.
  const [who, setWho] = useState<ArrivalScope>(hasProject ? "project" : "company");

  const freeDerivable = derivable.filter((derivation) => !derivation.added);
  const hasFreeSuggestions = freeDerivable.length > 0;
  const selectedDerivation = derivable.find((derivation) => derivation.key === selectedKey) ?? null;

  const key = manualKey ?? slugifyStepKey(title);
  const targetScope: ArrivalScope = hasProject ? who : "company";
  const isDuplicateKey =
    key.trim().length > 0 && existingKeys[targetScope].includes(key.trim().toLowerCase());
  const canSubmitCustom = key.trim().length > 0 && title.trim().length > 0 && !isDuplicateKey;

  const stepIndex = phase === "kind" ? 0 : 1;

  const selectKind = (next: Kind) => {
    setKind(next);
    setPhase("details");
  };

  const goBack = () => setPhase("kind");

  const submitSuggested = async () => {
    if (!selectedDerivation || submitting) return;
    setSubmitting(true);
    const ok = await onAddDerivable(selectedDerivation);
    setSubmitting(false);
    if (ok) onClose();
  };

  const submitCustom = async () => {
    if (!canSubmitCustom || submitting) return;
    setSubmitting(true);
    const ok = await onCreate(
      {
        key: key.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        href: href.trim() || undefined,
      },
      targetScope,
    );
    setSubmitting(false);
    if (ok) onClose();
  };

  const footer =
    phase === "kind" ? (
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
    ) : (
      <>
        <Button
          variant="secondary"
          onClick={goBack}
          disabled={submitting}
          icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
        >
          Back
        </Button>
        <Button
          variant="primary"
          onClick={() => void (kind === "suggested" ? submitSuggested() : submitCustom())}
          disabled={kind === "suggested" ? !selectedDerivation : !canSubmitCustom}
          loading={submitting}
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          Add step
        </Button>
      </>
    );

  // The kind picker is the left page, its details the right one: advancing slides the incoming
  // screen in from the right and pushes the outgoing one left, and going back reverses it, so the
  // transition reads as moving between two pages — the same pattern the create-project wizard's
  // add-source sub-flow uses.
  const offset = phase === "kind" ? -24 : 24;

  return (
    <Modal
      isOpen
      title="Add a step"
      description={<Stepper steps={STEP_LABELS} current={stepIndex} />}
      size="lg"
      isDismissDisabled={submitting}
      onClose={onClose}
      footer={footer}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${phase}-${kind ?? "none"}`}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: offset }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: offset }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        >
          {phase === "kind" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => selectKind("suggested")}
                disabled={!hasFreeSuggestions}
                className={`text-left ${radioCardClassName(false)} ${
                  hasFreeSuggestions ? "" : "cursor-not-allowed opacity-50"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-app-bg-soft text-app-brand">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="mt-3 block text-sm font-semibold text-app-text">Suggested</span>
                <span className="mt-1 block text-xs leading-relaxed text-app-text-muted">
                  Steps SprintStart can check for itself.
                </span>
                <span className="mt-2 block text-xs font-medium text-app-brand-text">
                  {hasFreeSuggestions
                    ? `${freeDerivable.length} ${
                        freeDerivable.length === 1 ? "suggestion" : "suggestions"
                      } still free`
                    : "All suggestions are already on the list"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => selectKind("custom")}
                className={radioCardClassName(false)}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-app-bg-soft text-app-brand">
                  <PenLine className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="mt-3 block text-sm font-semibold text-app-text">Custom</span>
                <span className="mt-1 block text-xs leading-relaxed text-app-text-muted">
                  Write one yourself.
                </span>
              </button>
            </div>
          )}

          {phase === "details" && kind === "suggested" && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs text-app-text-subtle">
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Suggestions always apply to every project — a derivation is company-wide.
              </p>

              <div className="space-y-2">
                {derivable.map((derivation) => {
                  const isSelected = selectedKey === derivation.key;
                  const howItsDone = howStepGetsDone({
                    key: derivation.key,
                    settledBy: "OBSERVED",
                    selfConfirmable: derivation.selfConfirmable,
                  });
                  const HowItsDoneIcon = howItsDone.icon;

                  return (
                    <button
                      key={derivation.key}
                      type="button"
                      disabled={derivation.added}
                      onClick={() => setSelectedKey(derivation.key)}
                      className={`flex w-full items-start gap-3 ${radioCardClassName(isSelected)} ${
                        derivation.added ? "cursor-not-allowed opacity-50" : ""
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          isSelected
                            ? "bg-app-brand text-white"
                            : "bg-app-bg-soft text-app-text-muted"
                        }`}
                      >
                        <HowItsDoneIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-app-text">
                          {derivation.suggestedTitle}
                        </span>
                        <span className="mt-1 block text-xs text-app-text-muted">
                          {derivation.suggestedDescription}
                        </span>
                        <span className="mt-2 block text-xs font-medium text-app-text-subtle">
                          {derivation.added ? "Already on the list" : howItsDone.label}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {phase === "details" && kind === "custom" && (
            <div className="space-y-3">
              <Field label="What needs to be done">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Request VPN access"
                />
              </Field>

              <Field
                label="How to do it"
                hint="Optional. Anything they need to know before starting."
              >
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
                      className={`flex items-center gap-2.5 ${radioCardClassName(who === "project")}`}
                    >
                      <FolderKanban
                        className={`h-4 w-4 shrink-0 ${who === "project" ? "text-app-brand" : "text-app-text-muted"}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-app-text">
                          {projectName ?? "This project"}
                        </span>
                        <span className="block text-xs text-app-text-muted">
                          Only people on this project.
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={who === "company"}
                      aria-label="Everyone"
                      onClick={() => setWho("company")}
                      className={`flex items-center gap-2.5 ${radioCardClassName(who === "company")}`}
                    >
                      <Building2
                        className={`h-4 w-4 shrink-0 ${who === "company" ? "text-app-brand" : "text-app-text-muted"}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-app-text">Everyone</span>
                        <span className="block text-xs text-app-text-muted">
                          Every new hire, any project.
                        </span>
                      </span>
                    </button>
                  </div>
                </fieldset>
              )}

              <details open className="text-xs text-app-text-subtle">
                <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  Advanced
                </summary>
                <div className="mt-2">
                  <Field
                    label="Key"
                    hint="A short id, fixed once saved — it is what people's records point at."
                    error={
                      isDuplicateKey ? "A step with this key is already on that list." : undefined
                    }
                  >
                    <Input
                      value={key}
                      onChange={(event) => setManualKey(event.target.value)}
                      placeholder="vpn-access"
                    />
                  </Field>
                </div>
              </details>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}
