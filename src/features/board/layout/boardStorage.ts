/**
 * The two announcements the board's stored arrangement makes, and why they are not one.
 *
 * The arrangement lives in seven small modules and is read by half a dozen surfaces that each keep
 * their own copy in React state. Local storage is not reactive, so anything that writes from
 * *outside* the surface holding that state has to say so. Two different audiences need to hear two
 * different things:
 *
 * - **written** — something changed; whatever is syncing this board upstream should send it. Fired
 *   by every writer, including the ordinary ones, because the surface that just wrote already has
 *   the new value on screen and only the sync needs telling.
 * - **replaced** — the arrangement on disk is no longer what its readers think it is, and they must
 *   look again. Fired only when a write came from somewhere those readers cannot see: the selection
 *   toolbar recording where a card came from, or a whole document arriving from the server.
 *
 * Collapsing them into one event was the first attempt and it is a render loop: every reader
 * re-reads on every write, including its own, and re-seats state it already had.
 *
 * Window events rather than the `storage` event, which browsers fire only in *other* tabs — the one
 * case this does not need.
 */
const WRITTEN = "sprintstart:board-storage-written";
const REPLACED = "sprintstart:board-storage-replaced";

/**
 * Whether writes are currently being applied *from* a document rather than made by somebody.
 *
 * Applying a document the server just sent writes all seven layers, and each of those would
 * otherwise announce itself as a change worth sending back — a round trip that ends where it
 * started, seven times.
 */
let applying = false;

/** Says something was written, so whatever syncs this board can send it on. */
export function notifyBoardStorageWritten(): void {
  if (applying) return;

  window.dispatchEvent(new Event(WRITTEN));
}

/** Says the stored arrangement is no longer what its readers think it is. */
export function notifyBoardStorageReplaced(): void {
  window.dispatchEvent(new Event(REPLACED));
}

/** Runs a set of writes as an application of an existing document, not as somebody's change. */
export function whileApplying(write: () => void): void {
  applying = true;
  try {
    write();
  } finally {
    applying = false;
  }
}

export function subscribeToBoardStorageWritten(listener: () => void): () => void {
  window.addEventListener(WRITTEN, listener);

  return () => window.removeEventListener(WRITTEN, listener);
}

export function subscribeToBoardStorageReplaced(listener: () => void): () => void {
  window.addEventListener(REPLACED, listener);

  return () => window.removeEventListener(REPLACED, listener);
}
