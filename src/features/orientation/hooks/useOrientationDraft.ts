import { useState } from "react";
import { STEP_ORDER } from "../steps";
import type { AuthorOrientationInput, OrientationPacket, OrientationStep } from "../types";

// A process-wide counter for stable local keys. Only ever used for React `key`s and never persisted
// or sent anywhere, so uniqueness within a session is all that matters — not a ref, so it can be read
// while seeding state without tripping the refs-during-render rule.
let keyCounter = 0;
const makeKey = () => `orientation-draft-${keyCounter++}`;

export type DraftCitation = {
  key: string;
  filename: string;
  /** Held as a string (never null) while editing; normalised to null on save when blank. */
  sourceUrl: string;
};

/** One of the five fixed steps being edited. Always present, even when blank ("not written yet"). */
export type DraftStep = {
  step: OrientationStep;
  title: string;
  body: string;
  citations: DraftCitation[];
};

/**
 * Draft state for a human-authored orientation packet, modelled as the five fixed steps of the path
 * to a pull request rather than a free list. The order is canonical (see {@link STEP_ORDER}), so
 * there is no reordering and no per-section step picker: a step is written or left blank, and only
 * the written ones are saved.
 *
 * Seeded from an existing packet (editing) or empty (authoring from blank). A packet is replaced
 * wholesale on save. Citations stay optional by design — the mandatory-citation rule is an AI
 * guardrail a human is not bound by, so a step with no sources is valid.
 */
export function useOrientationDraft(initial: OrientationPacket | null) {
  // Lazy initialisers: the draft is seeded from the packet once, on mount. Later edits live in
  // state, not the prop, so the editor never fights an incoming re-render.
  const [summary, setSummary] = useState(() => initial?.summary ?? "");
  const [steps, setSteps] = useState<DraftStep[]>(() => seedSteps(initial));

  const patchStep = (
    step: OrientationStep,
    patch: Partial<Omit<DraftStep, "step" | "citations">>,
  ) => setSteps((current) => current.map((s) => (s.step === step ? { ...s, ...patch } : s)));

  const setStepTitle = (step: OrientationStep, title: string) => patchStep(step, { title });
  const setStepBody = (step: OrientationStep, body: string) => patchStep(step, { body });

  /** Wipes a step back to empty — the replacement for deleting a section now that steps are fixed. */
  const clearStep = (step: OrientationStep) =>
    setSteps((current) =>
      current.map((s) => (s.step === step ? { step, title: "", body: "", citations: [] } : s)),
    );

  const addCitation = (step: OrientationStep) =>
    setSteps((current) =>
      current.map((s) =>
        s.step === step
          ? { ...s, citations: [...s.citations, { key: makeKey(), filename: "", sourceUrl: "" }] }
          : s,
      ),
    );

  const updateCitation = (
    step: OrientationStep,
    citationKey: string,
    patch: Partial<Omit<DraftCitation, "key">>,
  ) =>
    setSteps((current) =>
      current.map((s) =>
        s.step === step
          ? {
              ...s,
              citations: s.citations.map((c) => (c.key === citationKey ? { ...c, ...patch } : c)),
            }
          : s,
      ),
    );

  const removeCitation = (step: OrientationStep, citationKey: string) =>
    setSteps((current) =>
      current.map((s) =>
        s.step === step ? { ...s, citations: s.citations.filter((c) => c.key !== citationKey) } : s,
      ),
    );

  /** A step counts as written only when it carries both a title and a body. */
  const isFilled = (s: DraftStep) => s.title.trim().length > 0 && s.body.trim().length > 0;
  /** Exactly one of title/body filled — a half-written step that must not be saved silently. */
  const isPartial = (s: DraftStep) => s.title.trim().length > 0 !== s.body.trim().length > 0;

  const filledCount = steps.filter(isFilled).length;

  // At least one written step, and none left half-written — mirrors the backend's per-section rule.
  const isValid = filledCount > 0 && !steps.some(isPartial);

  const toInput = (): AuthorOrientationInput => ({
    summary: summary.trim().length > 0 ? summary.trim() : null,
    // Only written steps become sections, in the canonical order.
    sections: steps.filter(isFilled).map((s) => ({
      step: s.step,
      title: s.title.trim(),
      body: s.body.trim(),
      citations: s.citations
        // A citation with no filename is an empty row the author left behind, not a source.
        .filter((c) => c.filename.trim().length > 0)
        .map((c) => ({
          filename: c.filename.trim(),
          sourceUrl: c.sourceUrl.trim().length > 0 ? c.sourceUrl.trim() : null,
        })),
    })),
  });

  return {
    summary,
    setSummary,
    steps,
    setStepTitle,
    setStepBody,
    clearStep,
    addCitation,
    updateCitation,
    removeCitation,
    isFilled,
    isPartial,
    filledCount,
    isValid,
    toInput,
  };
}

/**
 * Builds the five fixed step slots from a packet. Every step exists up front, blank when the packet
 * had nothing for it. A packet that carries more than one section for the same step (an AI packet
 * can) is merged into that step rather than dropped: bodies joined, citations kept.
 */
function seedSteps(initial: OrientationPacket | null): DraftStep[] {
  const slots = new Map<OrientationStep, DraftStep>(
    STEP_ORDER.map((step) => [step, { step, title: "", body: "", citations: [] }]),
  );

  (initial?.sections ?? []).forEach((section) => {
    const slot = slots.get(section.step);
    if (!slot) return;

    const seededCitations = section.citations.map((c) => ({
      key: makeKey(),
      filename: c.filename,
      sourceUrl: c.sourceUrl ?? "",
    }));

    if (slot.title || slot.body) {
      slot.body = [slot.body, section.body].filter(Boolean).join("\n\n");
      slot.citations = [...slot.citations, ...seededCitations];
    } else {
      slot.title = section.title;
      slot.body = section.body;
      slot.citations = seededCitations;
    }
  });

  return STEP_ORDER.map((step) => slots.get(step)!);
}
