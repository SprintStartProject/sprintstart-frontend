import { useCallback, useEffect, useRef } from "react";

import { dashboardLayoutService } from "../../../services/dashboardLayoutService";
import { DASHBOARD_WIDGET_IDS } from "./catalog";
import {
  clearStoredLayout,
  LAYOUT_VERSION,
  markLayoutSynced,
  markLayoutUnsynced,
  readLayoutSynced,
  readStoredLayout,
  storeLayout,
} from "./storage";
import type { DashboardLayout } from "./types";

/**
 * How long the dashboard waits after a change before sending the layout up.
 *
 * A drag or a few resizes in a row are one arrangement, not one request each. Same number as the
 * board's sync, for the same reason.
 */
const QUIET_MS = 1200;

/** A change made before the first read settled, held until it has. */
type Pending = { kind: "layout"; layout: DashboardLayout } | { kind: "reset" } | null;

export type DashboardLayoutSync = {
  /** Sends the layout up, debounced. */
  push: (layout: DashboardLayout) => void;
  /** Forgets the layout on the server too. */
  reset: () => void;
};

/**
 * Keeps the user's dashboard layout on the server instead of only in this browser.
 *
 * Modelled on the board's `useBoardStructureSync`, and it decides the same way on arrival:
 *
 * - The server has a layout → it wins and is written into local storage, and `onPulled` asks the
 *   dashboard to read it again. It is the one that followed the user here.
 * - The server has none and this browser's copy is not in sync with it → the browser's copy is
 *   sent up. That is the migration for everybody who arranged their dashboard before this
 *   existed, and equally a change whose upload failed last time.
 * - The server has none and this browser's copy *was* in sync → the user reset it on another
 *   device. The stale copy here is dropped instead of uploaded, or a reset would only hold on the
 *   device it was made on. See `readLayoutSynced` for what "in sync" means.
 * - Neither has one → nothing happens; the default is derived, not stored.
 *
 * A change made before that first read has settled is not lost and not overwritten: it is held,
 * and sent instead of applying the server's copy — the user's latest gesture is the newer
 * statement.
 *
 * Failures interrupt nothing. The layout is already on screen and in local storage, so a request
 * that did not go through costs nothing today and is corrected by the next change.
 */
export function useDashboardLayoutSync(userId: string, onPulled: () => void): DashboardLayoutSync {
  /** Set once the first read for this user has settled, so nothing is pushed before it. */
  const pulledFor = useRef<string | null>(null);
  const pending = useRef<Pending>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The layout waiting in `timer`, so leaving the page can still send it. */
  const queued = useRef<DashboardLayout | null>(null);
  /**
   * Counts local changes. A request marks the layout as in sync only if no change was made while it
   * was on its way — otherwise it would vouch for a newer local layout it never carried.
   */
  const revision = useRef(0);

  /** Marks the layout as in sync, unless something changed locally since `sentAt`. */
  const confirmSynced = useCallback(
    (sentAt: number) => {
      if (revision.current === sentAt) markLayoutSynced(userId);
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;

    let active = true;
    pulledFor.current = null;
    pending.current = null;

    void (async () => {
      try {
        const server = await dashboardLayoutService.fetchLayout(LAYOUT_VERSION);
        if (!active) return;

        // Settled before anything below is awaited: a change made while the held one is being
        // sent goes through the debounce like any other, instead of landing in `pending` after
        // it has already been read and being thrown away with it.
        const waiting = pending.current;
        pending.current = null;
        pulledFor.current = userId;
        const sentAt = revision.current;

        if (waiting?.kind === "reset") {
          await dashboardLayoutService.resetLayout();
          confirmSynced(sentAt);
        } else if (waiting?.kind === "layout") {
          await dashboardLayoutService.saveLayout(LAYOUT_VERSION, waiting.layout);
          confirmSynced(sentAt);
        } else if (server.updatedAt !== null) {
          // Not checked here: `readStoredLayout` checks every item on the way out, the same as for
          // anything else in storage, and drops widgets and sizes this version does not know.
          storeLayout(userId, server.items as DashboardLayout);
          markLayoutSynced(userId);
          onPulled();
        } else {
          const local = readStoredLayout(userId, DASHBOARD_WIDGET_IDS);

          if (local && readLayoutSynced(userId)) {
            clearStoredLayout(userId);
            onPulled();
          } else if (local) {
            await dashboardLayoutService.saveLayout(LAYOUT_VERSION, local);
            // Only once it is up there: marked before, a failed upload would read as a reset on
            // the next visit and drop the very layout it exists to keep.
            confirmSynced(sentAt);
          } else {
            markLayoutSynced(userId);
          }
        }
      } catch {
        // Offline, or the endpoint is not deployed yet: the dashboard keeps working from local
        // storage exactly as it did before any of this existed.
      } finally {
        // A failed read settles too, so later changes are not held forever.
        if (active && pulledFor.current !== userId) {
          pulledFor.current = userId;
          pending.current = null;
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, onPulled, confirmSynced]);

  useEffect(() => {
    return () => {
      // Leaving the page inside the quiet window would otherwise drop the last change. Sent with
      // whatever token is current: harmless while signing out reloads the app, but a user switch
      // without a reload would send the previous user's layout under the new user's token.
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;

      const last = queued.current;
      queued.current = null;
      // Deliberately never marked as in sync: by the time this answers, the next mount may already
      // have changed the layout again, and "not in sync" only ever costs an upload of what the
      // server already has.
      if (last) void dashboardLayoutService.saveLayout(LAYOUT_VERSION, last).catch(() => {});
    };
  }, [userId]);

  const push = useCallback(
    (layout: DashboardLayout) => {
      if (!userId) return;

      revision.current += 1;
      markLayoutUnsynced(userId);

      if (pulledFor.current !== userId) {
        pending.current = { kind: "layout", layout };
        return;
      }

      if (timer.current) clearTimeout(timer.current);
      queued.current = layout;
      timer.current = setTimeout(() => {
        timer.current = null;
        queued.current = null;
        const sentAt = revision.current;
        void dashboardLayoutService
          .saveLayout(LAYOUT_VERSION, layout)
          .then(() => confirmSynced(sentAt))
          .catch(() => {});
      }, QUIET_MS);
    },
    [userId, confirmSynced],
  );

  const reset = useCallback(() => {
    if (!userId) return;

    revision.current += 1;
    markLayoutUnsynced(userId);

    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    queued.current = null;

    if (pulledFor.current !== userId) {
      pending.current = { kind: "reset" };
      return;
    }

    const sentAt = revision.current;
    void dashboardLayoutService
      .resetLayout()
      .then(() => confirmSynced(sentAt))
      .catch(() => {});
  }, [userId, confirmSynced]);

  return { push, reset };
}
