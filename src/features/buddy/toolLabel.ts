/**
 * Human-readable "what the buddy is doing right now" label for a backend tool it
 * runs mid-answer. Shown in place of a generic spinner so the hire sees the buddy
 * is looking at *their* real state, not just thinking.
 */
const TOOL_LABELS: Record<string, string> = {
  get_my_metrics: "Checking your progress…",
  get_my_competencies: "Looking at where you stand…",
  get_suggested_tasks: "Finding good tasks for you…",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? "Looking that up…";
}
