/**
 * Human-readable "what the buddy is doing right now" label for a backend tool it
 * runs mid-answer. Shown in place of a generic spinner so the hire sees the buddy
 * is looking at *their* real state, not just thinking.
 */
const TOOL_LABELS: Record<string, string> = {
  get_my_metrics: "Checking your progress…",
  get_my_competencies: "Looking at where you stand…",
  get_suggested_tasks: "Finding good tasks for you…",
  // Mounted in both modes: everybody asks where things are in the app.
  get_app_guide: "Checking where that is in the app…",
  // The buddy's own searches of the project's knowledge, run on the AI side.
  search_docs: "Searching the project's docs…",
  grep: "Searching the project's docs…",

  // Team-mode reads: the manager is asking about their *people*, and the labels say so.
  get_team_attention: "Seeing who needs attention…",
  find_member: "Looking up a teammate…",
  get_member_progress: "Checking a teammate's progress…",
  open_area: "Opening the project board…",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? "Looking that up…";
}
