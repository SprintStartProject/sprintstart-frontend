/**
 * Generic stream event returned by the backend when sending a buddy message. Mirrors the
 * backend's `BuddyStreamEvent`, which reuses the `sse_event` vocabulary the AI service has
 * always spoken (`tool_use`/`token`/`citation`/…).
 */
export interface BuddyStreamChunk {
  type:
    | "tool_use"
    | "token"
    | "citation"
    | "action_proposal"
    | "opening_action"
    | "reasoning"
    | "reset"
    | "done"
    | "error";
  content?: string;
  /** Set on a `reasoning` chunk: a delta of the thought being written, appended as it comes. */
  reasoning?: string;
  message?: string;
  name?: string;
  artifact_id?: string;
  filename?: string;
  source_url?: string;
  start_line?: number;
  start_page?: number;
  // Set only on an action_proposal chunk: the buddy is offering to do something, gated on confirm.
  action?: string;
  label?: string;
  question?: string;
  // Confirm payloads of the proposing action — echoed back verbatim on confirm
  // (as camelCase), so the target is the one the buddy proposed.
  task_id?: string;
  title?: string;
  attester_id?: string;
  github_login?: string;
  competency_key?: string;
  level?: string;
  // Path-action confirm payloads: which node of the hire's own onboarding path the action names,
  // the answer `answer_question` would send in their own words, and a new step's description.
  step_id?: string;
  question_id?: string;
  phase_id?: string;
  onboarding_task_id?: string;
  answer?: string;
  /** `answer_question` confirm payload: the options a multiple-choice answer stands for. */
  option_ids?: string[];
  description?: string;
  /** `request_skip` confirm payload: the reason that goes to the PM. */
  reason?: string;
  /** `add_path_step` confirm payload: where the step goes in its phase's graph. */
  waits_on_ids?: string[];
  unlocks_ids?: string[];
  /**
   * `place_checklist` confirm payload: the list the buddy offered to keep.
   *
   * Content rather than a target id, and echoed back for a sharper version of the same reason:
   * re-deriving these lines at confirm time would keep a card the hire never read.
   */
  checklist_title?: string;
  checklist_items?: string[];
  /** `amend_checklist`: which card of theirs the lines would be added to. */
  card_id?: string;
  /** `place_note` confirm payload. */
  note_text?: string;
  /** `reword_checklist_item`: the line as it reads now, and as it would read. */
  line_before?: string;
  line_after?: string;
  /** `place_link` / `edit_link`: where the link would point, and what it would be called. */
  link_url?: string;
  link_label?: string;
  /** `dismiss_cards` / `reorder_cards`: the cards in order, and their board names (display only). */
  card_ids?: string[];
  card_names?: string[];
  // Team-mode proposal: the stored proposal to confirm or dismiss by id. Present instead of the
  // per-action payload fields — the client echoes nothing back but this id.
  proposal_id?: string;
  // What confirming would change, in words: every team-mode proposal, and the hire's board edits.
  preview?: string;
  // Team-mode proposal: STANDARD, DESTRUCTIVE or BULK — how loudly the card warns.
  risk?: string;
}
