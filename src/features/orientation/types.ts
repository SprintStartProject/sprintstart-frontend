/**
 * Task-scoped orientation: what this project already says about doing the task
 * a hire has. Mirrors the backend's `GET /me/orientation` contract.
 *
 * There is no version, no approval and no author — a packet is disposable and
 * regenerates when the corpus moves.
 */

/**
 * The step of the path to a pull request a section belongs to. Segmentation is
 * by *process*, not by topic, which is what lets a hire on day three open
 * "check locally" without re-reading setup.
 */
export type OrientationStep =
  "SET_UP" | "FIND_THE_CODE" | "MAKE_THE_CHANGE" | "CHECK_LOCALLY" | "OPEN_THE_PR";

/** Where one claim came from, and where the hire can open it. */
export type OrientationCitation = {
  filename: string;
  chunkId: string;
  sourceUrl: string | null;
};

export type OrientationSection = {
  step: OrientationStep;
  title: string;
  body: string;
  /**
   * Never empty in practice — the AI service drops ungrounded sections before
   * they are returned. Rendered visibly, never as a tooltip: provenance is
   * the trust mechanism.
   */
  citations: OrientationCitation[];
};

/** A piece of existing material the packet drew on. */
export type OrientationSource = {
  filename: string;
  sourceUrl: string | null;
  artifactType: string | null;
};

/**
 * Who wrote a packet.
 *
 * `AI` packets are cached and revalidated against the corpus — served, deleted, or re-assembled as
 * the code they describe moves. A `HUMAN` packet is a person's own words (a PM's, or the hire's own,
 * fixed in place) and is served exactly as written: never regenerated, never auto-deleted. The
 * client badges it as human-written and offers to hand it back to the AI, never to "refresh" it.
 */
export type OrientationOrigin = "AI" | "HUMAN";

export type OrientationPacket = {
  taskId: string;
  taskTitle: string;
  summary: string | null;
  sections: OrientationSection[];
  sources: OrientationSource[];
  assembledAt: string;
  origin: OrientationOrigin;
};

/** One section a human is authoring; `chunkId` is the AI's, so a human citation carries only a link. */
export type AuthorOrientationCitationInput = {
  filename: string;
  sourceUrl: string | null;
};

export type AuthorOrientationSectionInput = {
  step: OrientationStep;
  title: string;
  body: string;
  citations: AuthorOrientationCitationInput[];
};

/**
 * A human-authored packet, replacing whatever was there.
 *
 * Unlike the AI contract, a section is not required to carry citations — the mandatory-citation
 * rule is a guardrail against the AI asserting things the corpus does not support, and a person
 * writing about a task they are doing is not bound by it.
 */
export type AuthorOrientationInput = {
  summary: string | null;
  sections: AuthorOrientationSectionInput[];
};

/**
 * Orientation for the hire's current task. Every combination is a real state,
 * none an error:
 * - no `taskId` → no current task, so nothing to orient for;
 * - `taskId` + `packet` → the assembled orientation;
 * - `taskId`, no `packet` → the corpus could not ground one, and `reason` says
 *   why. Never render a placeholder here — an invented packet on a task the
 *   hire is judged on is the failure this contract exists to prevent.
 */
export type MyOrientation = {
  taskId: string | null;
  taskTitle: string | null;
  taskUrl: string | null;
  packet: OrientationPacket | null;
  reason: string | null;
};
