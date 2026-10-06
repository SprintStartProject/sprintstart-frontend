import { SelectedBadge } from "../../../components/ui/SelectedBadge";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Check,
  FolderKanban,
  KeyRound,
  PenLine,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { IconTile } from "../../../components/ui/IconTile";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Textarea } from "../../../components/ui/Textarea";
import { howStepGetsDone } from "../howItsDone";
import { radioCardClassName } from "../radioCard";
import { slugifyStepKey } from "../slug";
import type { ArrivalScope, DerivableArrivalStep } from "../types";

type AddArrivalStepModalProps = {
  hasProject: boolean;
  projectName: string | null;
  derivable: DerivableArrivalStep[];
  /** The keys each list already holds, so a custom key that would collide is caught here rather
   * than coming back as a server 409. A key reused across the two lists is not a collision — that
   * is how a project overrides a company step — so the two are checked separately. */
  existingKeys: Record<ArrivalScope, string[]>;
  /** Adds the picked suggestions one after another. Resolves `false` if any of them failed, in
   * which case the ones that did land show up as `added` and drop out of the selection. */
  onAddDerivables: (derivations: DerivableArrivalStep[]) => Promise<boolean>;
  onCreate: (
    request: { key: string; title: string; description?: string; href?: string },
    who: ArrivalScope,
  ) => Promise<boolean>;
  onClose: () => void;
};

/**
 * "Add step" opens straight onto the steps SprintStart can check for itself, with "Custom" as one
 * more entry at the end of that list. The suggestions are multi-select, so the common case is a
 * few taps plus "Add step"; below a divider, "Custom" is the one entry that moves on to a form,
 * which has a way back to the list.
 *
 * Only ever mounted while open, so nothing here needs to reset itself on close — a fresh mount
 * starts clean the next time it opens.
 */
export function AddArrivalStepModal({
  hasProject,
  projectName,
  derivable,
  existingKeys,
  onAddDerivables,
  onCreate,
  onClose,
}: AddArrivalStepModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<"list" | "custom">("list");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
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

  const hasFreeSuggestions = derivable.some((derivation) => !derivation.added);
  // Filtered by `added` so that after a partly failed batch the ones that did land are not
  // submitted a second time.
  const selectedDerivations = derivable.filter(
    (derivation) => selectedKeys.includes(derivation.key) && !derivation.added,
  );

  const key = manualKey ?? slugifyStepKey(title);
  const targetScope: ArrivalScope = hasProject ? who : "company";
  const isDuplicateKey =
    key.trim().length > 0 && existingKeys[targetScope].includes(key.trim().toLowerCase());
  const canSubmitCustom = key.trim().length > 0 && title.trim().length > 0 && !isDuplicateKey;

  // Switching screens unmounts the control that was just activated, which would drop focus to
  // <body>. This container sits outside the animated screens so it is still there to take focus;
  // the initial mount is skipped so it does not fight the Modal's own autofocus.
  const bodyRef = useRef<HTMLDivElement>(null);
  const hasRenderedRef = useRef(false);
  useEffect(() => {
    if (!hasRenderedRef.current) {
      hasRenderedRef.current = true;
      return;
    }
    bodyRef.current?.focus();
  }, [phase]);

  const goBack = () => setPhase("list");

  const toggleSuggestion = (suggestionKey: string) =>
    setSelectedKeys((current) =>
      current.includes(suggestionKey)
        ? current.filter((selected) => selected !== suggestionKey)
        : [...current, suggestionKey],
    );

  const submitSuggested = async () => {
    if (selectedDerivations.length === 0 || submitting) return;
    setSubmitting(true);
    const ok = await onAddDerivables(selectedDerivations);
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
    phase === "list" ? (
      <>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => void submitSuggested()}
          disabled={selectedDerivations.length === 0}
          loading={submitting}
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          {selectedDerivations.length > 1 ? `Add ${selectedDerivations.length} steps` : "Add step"}
        </Button>
      </>
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
          onClick={() => void submitCustom()}
          disabled={!canSubmitCustom}
          loading={submitting}
          icon={<Plus className="h-4 w-4" aria-hidden="true" />}
        >
          Add step
        </Button>
      </>
    );

  // The list is the left page, the custom form the right one: advancing slides the incoming
  // screen in from the right and pushes the outgoing one left, and going back reverses it, so the
  // transition reads as moving between two pages — the same pattern the create-project wizard's
  // add-source sub-flow uses.
  const offset = phase === "list" ? -24 : 24;

  return (
    <Modal
      isOpen
      title="Add a step"
      description="Pick any steps SprintStart can check for itself, or write your own."
      size="lg"
      isDismissDisabled={submitting}
      onClose={onClose}
      footer={footer}
    >
      <div
        ref={bodyRef}
        tabIndex={-1}
        data-testid="add-arrival-step-body"
        className="focus:outline-hidden"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={phase}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: offset }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: offset }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          >
            {phase === "list" && (
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs text-app-text-subtle">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {derivable.length === 0
                    ? "No suggestions are available right now."
                    : hasFreeSuggestions
                      ? "Suggestions always apply to every project — a derivation is company-wide."
                      : "All suggestions are already on the list."}
                </p>

                <div className="space-y-2">
                  {derivable.map((derivation) => {
                    const isSelected = selectedKeys.includes(derivation.key) && !derivation.added;
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
                        aria-pressed={isSelected}
                        disabled={derivation.added || submitting}
                        onClick={() => toggleSuggestion(derivation.key)}
                        className={`flex w-full items-start gap-3 ${radioCardClassName(isSelected)} ${
                          derivation.added ? "cursor-not-allowed opacity-50" : ""
                        }`}
                      >
                        {isSelected ? <SelectedBadge /> : null}
                        <IconTile
                          icon={HowItsDoneIcon}
                          size="lg"
                          tone={isSelected ? "accent" : "neutral"}
                        />
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
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border ${
                            isSelected
                              ? "border-app-brand bg-app-brand text-white"
                              : "border-app-border bg-app-bg"
                          }`}
                          aria-hidden="true"
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    );
                  })}

                  {derivable.length > 0 && <hr className="my-3 border-app-border" />}

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setPhase("custom")}
                    className={`flex w-full items-start gap-3 ${radioCardClassName(false)}`}
                  >
                    <IconTile icon={PenLine} size="lg" tone="neutral" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-app-text">Custom</span>
                      <span className="mt-1 block text-xs text-app-text-muted">
                        Write one yourself.
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            )}

            {phase === "custom" && (
              <div className="space-y-3">
                <Field label="What needs to be done" required>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Request VPN access"
                  />
                </Field>

                <Field
                  label="How to do it"
                  optional
                  hint="Anything they need to know before starting."
                >
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    minRows={2}
                    placeholder="Ask in #it-helpdesk; usually same-day."
                  />
                </Field>

                <Field label="Where to do it" optional hint="Link to tool or docs.">
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
                        {who === "project" ? <SelectedBadge /> : null}
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
                        {who === "company" ? <SelectedBadge /> : null}
                        <Building2
                          className={`h-4 w-4 shrink-0 ${who === "company" ? "text-app-brand" : "text-app-text-muted"}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-app-text">
                            Everyone
                          </span>
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
      </div>
    </Modal>
  );
}
