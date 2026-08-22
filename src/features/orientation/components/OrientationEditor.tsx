import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, Undo2, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { SidePanel } from "../../../components/ui/SidePanel";
import { OrientationPanel } from "./OrientationPanel";
import { STEP_LABELS } from "../steps";
import { useOrientationDraft } from "../hooks/useOrientationDraft";
import type {
  AuthorOrientationInput,
  MyOrientation,
  OrientationCitation,
  OrientationPacket,
  OrientationSource,
  OrientationStep,
} from "../types";

const STEP_ORDER: OrientationStep[] = [
  "SET_UP",
  "FIND_THE_CODE",
  "MAKE_THE_CHANGE",
  "CHECK_LOCALLY",
  "OPEN_THE_PR",
];

type OrientationEditorProps = {
  /** The task the orientation belongs to; its title heads the editor and preview. */
  taskTitle: string;
  taskUrl: string | null;
  /** The packet being edited, or null to author from blank. */
  initial: OrientationPacket | null;
  onSave: (input: AuthorOrientationInput) => Promise<boolean>;
  /** Hands the task back to AI assembly. Omitted when there is no packet to revert. */
  onRevert?: () => Promise<boolean>;
  onClose: () => void;
};

const inputClasses =
  "w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus";

/**
 * The editor a PM or a hire uses to write a task's orientation by hand.
 *
 * A human packet is served exactly as written and never AI-regenerated, so this is genuine authoring,
 * not a suggestion the AI overrides. The preview on the right reuses the hire's own renderer
 * ([OrientationPanel]) so what an author sees cannot drift from what a hire will read. Citations are
 * optional throughout — the mandatory-citation rule is an AI guardrail a person is not bound by.
 */
export function OrientationEditor({
  taskTitle,
  taskUrl,
  initial,
  onSave,
  onRevert,
  onClose,
}: OrientationEditorProps) {
  const draft = useOrientationDraft(initial);
  const [busy, setBusy] = useState<"saving" | "reverting" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = buildPreview(taskTitle, taskUrl, draft.toInput());

  const handleSave = async () => {
    if (!draft.isValid || busy) return;
    setBusy("saving");
    setError(null);
    try {
      const ok = await onSave(draft.toInput());
      if (ok) onClose();
      else setError("Could not save this orientation. Please try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this orientation.");
    } finally {
      setBusy(null);
    }
  };

  const handleRevert = async () => {
    if (!onRevert || busy) return;
    setBusy("reverting");
    setError(null);
    try {
      const ok = await onRevert();
      if (ok) onClose();
      else setError("Could not hand this back to the AI. Please try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not hand this back to the AI.");
    } finally {
      setBusy(null);
    }
  };

  // Portaled to <body> so the fixed panel clears any transformed ancestor (the sliding tab panel)
  // that would otherwise contain it. The extra AnimatePresence resets the `initial={false}` that a
  // surrounding SlidingTabPanel's AnimatePresence pushes down the tree and across the portal —
  // without it the panel inherits "no enter animation" and pops in instead of sliding.
  return createPortal(
    <AnimatePresence>
      <SidePanel
        isOpen
        onClose={onClose}
        title="Write this orientation yourself"
        description={
          <>
            For “{taskTitle}”. Saving pins your words — the AI won&apos;t rewrite them. Sources are
            optional.
          </>
        }
        widthClassName="w-full sm:w-[min(96vw,40rem)] lg:w-[min(84vw,64rem)]"
        contentClassName="p-0"
        closeAriaLabel="Close orientation editor"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {onRevert && (
              <Button
                variant="secondary"
                data-testid="revert-orientation"
                onClick={() => void handleRevert()}
                disabled={busy !== null}
                loading={busy === "reverting"}
                icon={<Undo2 className="h-4 w-4" />}
              >
                Hand back to AI
              </Button>
            )}
            <Button
              variant="primary"
              data-testid="save-orientation"
              onClick={() => void handleSave()}
              disabled={!draft.isValid || busy !== null}
              loading={busy === "saving"}
              icon={<Save className="h-4 w-4" />}
            >
              Save orientation
            </Button>
          </div>
        }
      >
        <div data-testid="orientation-editor" className="grid grid-cols-1 lg:grid-cols-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
            className="space-y-4 border-b border-app-border p-5 lg:border-r lg:border-b-0"
          >
            <div>
              <label
                htmlFor="orientation-summary"
                className="mb-1 block text-xs font-medium text-app-text"
              >
                One-line summary <span className="text-app-text-subtle">(optional)</span>
              </label>
              <input
                id="orientation-summary"
                value={draft.summary}
                onChange={(event) => draft.setSummary(event.target.value)}
                placeholder="What this task is, in a sentence."
                className={inputClasses}
              />
            </div>

            {draft.sections.length === 0 && (
              <p className="rounded-lg border border-dashed border-app-border p-4 text-center text-xs text-app-text-muted">
                No sections yet. Add one for each step of getting this task shipped.
              </p>
            )}

            {draft.sections.map((section, index) => (
              <fieldset
                key={section.key}
                data-testid="editor-section"
                className="space-y-2 rounded-xl border border-app-border p-3"
              >
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Step"
                    value={section.step}
                    onChange={(event) =>
                      draft.updateSection(section.key, {
                        step: event.target.value as OrientationStep,
                      })
                    }
                    className="rounded-lg border border-app-border bg-app-surface px-2 py-1.5 text-xs font-medium text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                  >
                    {STEP_ORDER.map((step) => (
                      <option key={step} value={step}>
                        {STEP_LABELS[step]}
                      </option>
                    ))}
                  </select>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => draft.moveSection(section.key, -1)}
                      className="rounded-lg p-1 text-app-text-muted transition-colors hover:bg-app-surface-hover disabled:opacity-40"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === draft.sections.length - 1}
                      onClick={() => draft.moveSection(section.key, 1)}
                      className="rounded-lg p-1 text-app-text-muted transition-colors hover:bg-app-surface-hover disabled:opacity-40"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove section"
                      onClick={() => draft.removeSection(section.key)}
                      className="rounded-lg p-1 text-app-danger-text transition-colors hover:bg-app-danger-bg"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  aria-label="Section title"
                  value={section.title}
                  onChange={(event) =>
                    draft.updateSection(section.key, { title: event.target.value })
                  }
                  placeholder="Section heading"
                  className={inputClasses}
                />
                <textarea
                  aria-label="Section body"
                  rows={4}
                  value={section.body}
                  onChange={(event) =>
                    draft.updateSection(section.key, { body: event.target.value })
                  }
                  placeholder="What to do at this step. Markdown is fine."
                  className={inputClasses}
                />

                <div className="space-y-1.5">
                  {section.citations.map((citation) => (
                    <div key={citation.key} className="flex items-center gap-1.5">
                      <input
                        aria-label="Source name"
                        value={citation.filename}
                        onChange={(event) =>
                          draft.updateCitation(section.key, citation.key, {
                            filename: event.target.value,
                          })
                        }
                        placeholder="Source (e.g. README.md)"
                        className="w-1/3 rounded-lg border border-app-border bg-app-surface px-2 py-1.5 text-xs text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                      />
                      <input
                        aria-label="Source link"
                        value={citation.sourceUrl}
                        onChange={(event) =>
                          draft.updateCitation(section.key, citation.key, {
                            sourceUrl: event.target.value,
                          })
                        }
                        placeholder="https://… (optional)"
                        className="flex-1 rounded-lg border border-app-border bg-app-surface px-2 py-1.5 text-xs text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                      />
                      <button
                        type="button"
                        aria-label="Remove source"
                        onClick={() => draft.removeCitation(section.key, citation.key)}
                        className="rounded-lg p-1 text-app-text-muted transition-colors hover:bg-app-surface-hover"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => draft.addCitation(section.key)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                  >
                    <Plus className="h-3 w-3" />
                    Add a source
                  </button>
                </div>
              </fieldset>
            ))}

            <button
              type="button"
              data-testid="add-section"
              onClick={() => draft.addSection(nextStep(draft.sections.map((s) => s.step)))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-app-border px-3 py-2 text-xs font-medium text-app-text transition-colors hover:bg-app-surface-hover"
            >
              <Plus className="h-3.5 w-3.5" />
              Add a section
            </button>

            {error && (
              <p
                data-testid="editor-error"
                className="rounded-lg bg-app-danger-bg p-2.5 text-xs font-medium text-app-danger-text"
              >
                {error}
              </p>
            )}
          </form>

          <div className="bg-app-surface-muted p-5">
            <p className="mb-2 text-[11px] font-semibold tracking-wide text-app-text-subtle uppercase">
              What the hire will see
            </p>
            <OrientationPanel
              orientation={preview}
              isLoading={false}
              error={null}
              onRetry={() => {}}
            />
          </div>
        </div>
      </SidePanel>
    </AnimatePresence>,
    document.body,
  );
}

/** The first step not already used, so "Add a section" lands somewhere sensible rather than always SET_UP. */
function nextStep(used: OrientationStep[]): OrientationStep {
  return STEP_ORDER.find((step) => !used.includes(step)) ?? "MAKE_THE_CHANGE";
}

/** Builds a live preview packet from the draft, deriving sources from the distinct citations as the backend does. */
function buildPreview(
  taskTitle: string,
  taskUrl: string | null,
  input: AuthorOrientationInput,
): MyOrientation {
  const sourceMap = new Map<string, OrientationSource>();
  input.sections.forEach((section) =>
    section.citations.forEach((citation) => {
      const dedupeKey = `${citation.filename} ${citation.sourceUrl ?? ""}`;
      if (!sourceMap.has(dedupeKey)) {
        sourceMap.set(dedupeKey, {
          filename: citation.filename,
          sourceUrl: citation.sourceUrl,
          artifactType: null,
        });
      }
    }),
  );

  const packet: OrientationPacket = {
    taskId: "preview",
    taskTitle,
    summary: input.summary,
    sections: input.sections.map((section) => ({
      step: section.step,
      title: section.title,
      body: section.body,
      citations: section.citations.map((citation): OrientationCitation => ({
        filename: citation.filename,
        chunkId: "",
        sourceUrl: citation.sourceUrl,
      })),
    })),
    sources: [...sourceMap.values()],
    assembledAt: new Date().toISOString(),
    origin: "HUMAN",
  };

  // A preview always has a task and a packet, so the renderer shows the packet branch, never an
  // empty state — an author needs to see their own words even before the first save.
  return { taskId: "preview", taskTitle, taskUrl, packet, reason: null };
}
