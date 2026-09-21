import { Check, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Spinner } from "../../../components/ui/Spinner";
import { skillSuggestionKey } from "../skillSuggestion";
import type { Skill, SkillSuggestion } from "../types";

export type SkillSuggestionPanelProps = {
  currentSkills: Skill[];
  suggestions: SkillSuggestion[];
  selectedKeys: ReadonlySet<string>;
  isLoading: boolean;
  isApplying: boolean;
  errorMessage: string | null;
  onToggle: (key: string) => void;
  onApply: () => void;
  onRetry: () => void;
  onClose: () => void;
};

function confidenceVariant(confidence: string): "success" | "warning" | "neutral" {
  if (confidence.toLocaleLowerCase() === "high") return "success";
  if (confidence.toLocaleLowerCase() === "medium") return "warning";
  return "neutral";
}

/**
 * Review surface for AI skill suggestions.
 *
 * Current skills are shown as locked, retained entries. Suggestions remain local until
 * Apply is pressed; closing the panel therefore never needs a compensating backend write.
 */
export function SkillSuggestionPanel({
  currentSkills,
  suggestions,
  selectedKeys,
  isLoading,
  isApplying,
  errorMessage,
  onToggle,
  onApply,
  onRetry,
  onClose,
}: SkillSuggestionPanelProps) {
  const currentIds = new Set(currentSkills.map(({ id }) => id));
  const currentNames = new Set(currentSkills.map(({ name }) => name.trim().toLocaleLowerCase()));
  const reviewableSuggestions = suggestions.filter(
    (suggestion) =>
      !(suggestion.skillId && currentIds.has(suggestion.skillId)) &&
      !currentNames.has(suggestion.name.trim().toLocaleLowerCase()),
  );
  const selectedCount = reviewableSuggestions.filter((suggestion) =>
    selectedKeys.has(skillSuggestionKey(suggestion)),
  ).length;

  return (
    <motion.section
      data-testid="skill-suggestion-panel"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="mt-4 rounded-2xl border border-app-brand-border bg-app-brand-soft p-4"
      aria-labelledby="skill-suggestion-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-app-brand" aria-hidden="true" />
            <h5 id="skill-suggestion-title" className="text-sm font-semibold text-app-text">
              Review AI suggestions
            </h5>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-app-text-muted">
            Current skills stay linked. Choose which suggestions to add before anything is saved.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Close skill suggestions"
          onClick={onClose}
          disabled={isApplying}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <EmptyState
          size="sm"
          className="mt-4"
          icon={<Spinner size="lg" silent />}
          title="Finding relevant skills"
        >
          The role, project industry and available catalog are being reviewed.
        </EmptyState>
      ) : errorMessage ? (
        <EmptyState
          size="sm"
          className="mt-4"
          title="Suggestions could not be loaded"
          action={
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          {errorMessage}
        </EmptyState>
      ) : reviewableSuggestions.length === 0 ? (
        <EmptyState size="sm" className="mt-4" title="No new suggestions">
          The AI did not find any additional skills for this role.
        </EmptyState>
      ) : (
        <>
          {currentSkills.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-app-text-muted">Kept current skills</p>
              <div className="flex flex-wrap gap-2">
                {currentSkills.map((skill) => (
                  <span
                    key={skill.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-surface px-3 py-1 text-xs text-app-text"
                  >
                    <Check className="h-3 w-3 text-app-success-text" aria-hidden="true" />
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {reviewableSuggestions.map((suggestion) => {
                const key = skillSuggestionKey(suggestion);
                const checked = selectedKeys.has(key);

                return (
                  <motion.label
                    key={key}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                      checked
                        ? "border-app-brand bg-app-surface"
                        : "border-app-border bg-app-surface-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isApplying}
                      onChange={() => onToggle(key)}
                      aria-label={`Accept ${suggestion.name}`}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-app-brand focus-visible:ring-2 focus-visible:ring-app-focus"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-app-text">{suggestion.name}</span>
                        <Badge variant={confidenceVariant(suggestion.confidence)} size="sm">
                          {suggestion.confidence || "medium"} confidence
                        </Badge>
                        {suggestion.isNew && (
                          <Badge variant="brand" size="sm">
                            New skill
                          </Badge>
                        )}
                      </span>
                      {suggestion.category && (
                        <span className="mt-1 block text-xs text-app-text-subtle">
                          {suggestion.category}
                        </span>
                      )}
                      {suggestion.reason && (
                        <span className="mt-1 block text-xs leading-relaxed text-app-text-muted">
                          {suggestion.reason}
                        </span>
                      )}
                    </span>
                  </motion.label>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-app-brand-border pt-4">
            <span className="text-xs text-app-text-muted">
              {selectedCount} of {reviewableSuggestions.length} selected
            </span>
            <Button
              variant="primary"
              size="sm"
              loading={isApplying}
              disabled={selectedCount === 0}
              onClick={onApply}
              icon={<Check className="h-3.5 w-3.5" />}
            >
              Apply {selectedCount} {selectedCount === 1 ? "suggestion" : "suggestions"}
            </Button>
          </div>
        </>
      )}
    </motion.section>
  );
}
