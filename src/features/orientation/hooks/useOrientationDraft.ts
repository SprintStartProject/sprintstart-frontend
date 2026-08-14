import { useState } from "react";
import type { AuthorOrientationInput, OrientationPacket, OrientationStep } from "../types";

// A process-wide counter for stable local keys. Only ever used for React `key`s and never persisted
// or sent anywhere, so uniqueness within a session is all that matters — not a ref, so it can be read
// while seeding state without tripping the refs-during-render rule.
let keyCounter = 0;
const makeKey = () => `orientation-draft-${keyCounter++}`;

/** A section being edited, with a stable local key so reorder/remove don't reshuffle React state. */
export type DraftSection = {
  key: string;
  step: OrientationStep;
  title: string;
  body: string;
  citations: DraftCitation[];
};

export type DraftCitation = {
  key: string;
  filename: string;
  /** Held as a string (never null) while editing; normalised to null on save when blank. */
  sourceUrl: string;
};

/**
 * Draft state for a human-authored orientation packet.
 *
 * Seeded from an existing packet (editing) or empty (authoring from blank). A packet is replaced
 * wholesale on save, so the draft is the whole thing — there is no per-field diffing to protect.
 * Citations are optional by design: the mandatory-citation rule is an AI guardrail a human is not
 * bound by, so a section with no sources is valid.
 */
export function useOrientationDraft(initial: OrientationPacket | null) {
  // Lazy initialisers: the draft is seeded from the packet once, on mount. Later edits live in
  // state, not the prop, so the editor never fights an incoming re-render.
  const [summary, setSummary] = useState(() => initial?.summary ?? "");
  const [sections, setSections] = useState<DraftSection[]>(() =>
    (initial?.sections ?? []).map((section) => ({
      key: makeKey(),
      step: section.step,
      title: section.title,
      body: section.body,
      citations: section.citations.map((citation) => ({
        key: makeKey(),
        filename: citation.filename,
        sourceUrl: citation.sourceUrl ?? "",
      })),
    })),
  );

  const addSection = (step: OrientationStep) =>
    setSections((current) => [
      ...current,
      { key: makeKey(), step, title: "", body: "", citations: [] },
    ]);

  const updateSection = (key: string, patch: Partial<Omit<DraftSection, "key" | "citations">>) =>
    setSections((current) =>
      current.map((section) => (section.key === key ? { ...section, ...patch } : section)),
    );

  const removeSection = (key: string) =>
    setSections((current) => current.filter((section) => section.key !== key));

  const moveSection = (key: string, direction: -1 | 1) =>
    setSections((current) => {
      const index = current.findIndex((section) => section.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const addCitation = (sectionKey: string) =>
    setSections((current) =>
      current.map((section) =>
        section.key === sectionKey
          ? {
              ...section,
              citations: [...section.citations, { key: makeKey(), filename: "", sourceUrl: "" }],
            }
          : section,
      ),
    );

  const updateCitation = (
    sectionKey: string,
    citationKey: string,
    patch: Partial<Omit<DraftCitation, "key">>,
  ) =>
    setSections((current) =>
      current.map((section) =>
        section.key === sectionKey
          ? {
              ...section,
              citations: section.citations.map((citation) =>
                citation.key === citationKey ? { ...citation, ...patch } : citation,
              ),
            }
          : section,
      ),
    );

  const removeCitation = (sectionKey: string, citationKey: string) =>
    setSections((current) =>
      current.map((section) =>
        section.key === sectionKey
          ? { ...section, citations: section.citations.filter((c) => c.key !== citationKey) }
          : section,
      ),
    );

  // Mirrors the backend's rule: at least one section, each with a non-blank title and body.
  const isValid =
    sections.length > 0 &&
    sections.every((section) => section.title.trim().length > 0 && section.body.trim().length > 0);

  const toInput = (): AuthorOrientationInput => ({
    summary: summary.trim().length > 0 ? summary.trim() : null,
    sections: sections.map((section) => ({
      step: section.step,
      title: section.title.trim(),
      body: section.body.trim(),
      citations: section.citations
        // A citation with no filename is an empty row the author left behind, not a source.
        .filter((citation) => citation.filename.trim().length > 0)
        .map((citation) => ({
          filename: citation.filename.trim(),
          sourceUrl: citation.sourceUrl.trim().length > 0 ? citation.sourceUrl.trim() : null,
        })),
    })),
  });

  return {
    summary,
    setSummary,
    sections,
    addSection,
    updateSection,
    removeSection,
    moveSection,
    addCitation,
    updateCitation,
    removeCitation,
    isValid,
    toInput,
  };
}
