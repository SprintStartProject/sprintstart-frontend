import { useEffect, useRef } from "react";

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
 * Sends the whole arrangement up whenever something writes, debounced. Failures are swallowed on
 * purpose: the arrangement is already on screen and already in local storage, so a request that did
 * not go through costs the hire nothing today and is corrected by the next change. A toast for
 * every failed sync of a fold would be the app complaining about its own bookkeeping.
 */
export function useBoardStructureSync(boardId: string, projectId: string): void {
  /** Set once the first read has settled, so nothing is pushed before the server has been asked. */
  const pulledFor = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      } catch {
        // Offline, or the endpoint is not deployed yet. The board works exactly as it did before
        // any of this existed, which is the correct amount of noise to make about it.
      } finally {
        if (active) pulledFor.current = projectId;
      }
    })();

    return () => {
      active = false;
    };
  }, [boardId, projectId]);

  useEffect(() => {
    if (!boardId || !projectId) return;

    const push = () => {
      // Never before the first read has settled: pushing first would send this browser's copy over
      // an arrangement the server already has, which is the one thing the migration above exists to
      // avoid.
      if (pulledFor.current !== projectId) return;

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void boardService
          .saveStructure(projectId, toWire(readBoardDocument(boardId, projectId)))
          .catch(() => {});
      }, QUIET_MS);
    };

    const stop = subscribeToBoardStorageWritten(push);

    return () => {
      stop();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [boardId, projectId]);
}
