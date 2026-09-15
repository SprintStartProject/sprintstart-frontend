import { useCallback, useEffect, useRef, useState } from "react";

import { boardService } from "../../../services/boardService";
import { subscribeToBoardStorageWritten } from "../layout/boardStorage";
import {
  applyBoardDocument,
  fromWire,
  isEmptyDocument,
  readBoardDocument,
  toWire,
} from "./boardDocument";

/**
 * How long the board waits after a change before sending the arrangement up.
 *
 * The client writes on every gesture — a tick, a fold, a drag, a highlight — and a lot of those
 * arrive in bursts: arranging a board is twenty changes in twenty seconds. A request each would be
 * twenty requests to say one thing, and the last one says all of it.
 *
 * Short enough that closing the tab a moment after the last change still catches it, long enough
 * that a drag across the board is one request rather than one per frame.
 */
const QUIET_MS = 1200;

/**
 * Keeps this hire's arrangement on the server instead of only in this browser.
 *
 * ### What it does on arrival
 *
 * Reads the server's arrangement once per project and then decides which side wins, which is the
 * one genuinely interesting decision here:
 *
 * - The server has an arrangement → it wins, and it is written into the local layers. It is the
 *   thing that followed the hire here; the browser's copy is whatever this machine happened to
 *   have.
 * - The server has nothing and this browser does → the browser's copy is sent up. This is the
 *   migration, and it runs itself: everybody who has been using the board so far has months of
 *   arrangement in local storage, and a first sync that started from empty would silently throw all
 *   of it away in exchange for a feature.
 * - Neither has anything → nothing happens, which is a new hire.
 *
 * Deliberately not a merge. Two arrangements of the same board cannot be merged into a third one
 * anybody made, and the only moment they can both be non-empty is the one migration above.
 *
 * ### What it does afterwards
 *
 * Sends the whole arrangement up whenever something writes, debounced. A failure interrupts
 * nothing: the arrangement is already on screen and already in local storage, so a request that did
 * not go through costs the hire nothing today and is corrected by the next change. A toast for
 * every failed sync of a fold would be the app complaining about its own bookkeeping.
 *
 * It is still *said*, once, quietly — which is what this returns. Silence was right about the
 * interruption and wrong about the fact: a hire who arranges their board on a laptop and opens it
 * on a phone the next morning has been told nothing about why none of it is there. What they need
 * is not an error, it is the word "here" — this is kept on this device, and the reason is that the
 * server could not be reached.
 *
 * @returns whether the arrangement is only in this browser, as far as the last attempt could tell.
 */
export function useBoardStructureSync(boardId: string, projectId: string): boolean {
  /** Set once the first read has settled, so nothing is pushed before the server has been asked. */
  const pulledFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localOnly, setLocalOnly] = useState(false);

  /**
   * What the last exchange with the server showed.
   *
   * Latched on failure and cleared on the next success, rather than counting attempts: the question
   * a hire is asking is "is my board up there", and the last answer is the only one that bears on
   * it. A request that fails and is followed by one that works has cost them nothing to know about.
   */
  const settled = useCallback((reached: boolean) => setLocalOnly(!reached), []);
  // Switching projects does not clear it here: the read below settles it either way, a moment
  // later, and clearing it from the effect body is a synchronous setState inside an effect — which
  // this codebase rejects, rightly, for the cascading render it causes.

  useEffect(() => {
    if (!boardId || !projectId) return;

    let active = true;
    pulledFor.current = null;

    void (async () => {
      try {
        const server = fromWire(await boardService.fetchStructure(projectId));
        if (!active) return;

        if (isEmptyDocument(server)) {
          const local = readBoardDocument(boardId, projectId);
          if (!isEmptyDocument(local)) await boardService.saveStructure(projectId, toWire(local));
        } else {
          applyBoardDocument(boardId, projectId, server);
        }
        if (active) settled(true);
      } catch {
        // Offline, or the endpoint is not deployed yet. The board works exactly as it did before
        // any of this existed, which is the correct amount of noise to make about it — beyond the
        // one line that says where the arrangement is being kept.
        if (active) settled(false);
      } finally {
        if (active) pulledFor.current = projectId;
      }
    })();

    return () => {
      active = false;
    };
  }, [boardId, projectId, settled]);

  useEffect(() => {
    if (!boardId || !projectId) return;

    // A request already in flight when the hire switches project would otherwise report its result
    // against the board they moved to — "saved on this device" about a board that never failed.
    let live = true;

    const push = () => {
      // Never before the first read has settled: pushing first would send this browser's copy over
      // an arrangement the server already has, which is the one thing the migration above exists to
      // avoid.
      if (pulledFor.current !== projectId) return;

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void boardService
          .saveStructure(projectId, toWire(readBoardDocument(boardId, projectId)))
          .then(() => live && settled(true))
          .catch(() => live && settled(false));
      }, QUIET_MS);
    };

    const stop = subscribeToBoardStorageWritten(push);

    return () => {
      live = false;
      stop();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [boardId, projectId, settled]);

  return localOnly;
}
