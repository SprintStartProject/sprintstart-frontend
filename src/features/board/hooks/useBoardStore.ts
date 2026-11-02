import { useEffect, useState } from "react";
import { useToast } from "../../../context/useToast";
import { subscribeToBoardStorageReplaced } from "../layout/boardStorage";
import { useBoardStructureSync } from "../sync/useBoardStructureSync";
import { useBoard } from "./useBoard";

/**
 * The board as the server has it, and the stored arrangement it is read against.
 *
 * Failed writes are reported the way every other failed write in the app is: as a toast, rather
 * than as a paragraph this page invented for itself. The card or list it failed on is still on
 * screen and unchanged, so the message is about the attempt, not about the surface.
 */
export function useBoardStore(projectId: string) {
  const toast = useToast();
  const data = useBoard(projectId);
  const { board, loading, dismissError, writeError } = data;

  /**
   * Whether to put a spinner where the board is.
   *
   * Only while there is no board *for this project* to show. A re-read of a board already on screen
   * keeps it there: swapping it for a spinner unmounts every card, and the hire comes back to the
   * top of a board they were working somewhere in the middle of. Compared against the selected
   * project rather than against `board !== null`, so switching projects still hides the old one --
   * showing another project's cards under this project's name, even for a moment, is worse than
   * showing nothing.
   */
  const showLoading = loading && board?.projectId !== projectId;

  const showErrorToast = toast.error;

  useEffect(() => {
    if (!dismissError) return;
    showErrorToast("That card couldn't be removed", {
      description: "It's still here — try again.",
    });
  }, [dismissError, showErrorToast]);

  useEffect(() => {
    if (!writeError) return;
    showErrorToast("That change didn't save", {
      description: "Your board is as it was — try again.",
    });
  }, [writeError, showErrorToast]);

  // Folded cards are a preference, not board state: kept per board in local storage, read once the
  // board arrives and written on every fold. A board that will not load has nothing to fold.
  const boardId = board?.boardId ?? "";

  // Keeps this hire's arrangement on the server rather than only in this browser, and brings it
  // down on the first load of a visit. See `sync/useBoardStructureSync.ts`.
  const localOnly = useBoardStructureSync(boardId, projectId);

  /**
   * Bumped whenever the stored arrangement is replaced under this page -- by the sync above pulling
   * it down, or by a surface outside the board writing into it.
   *
   * Part of the key every local read is guarded by, so one counter refreshes all of them. Local
   * storage is not reactive and these are read once into state; without this, an arrangement that
   * arrived from the server sat on disk until the next navigation.
   */
  const [storageRevision, setStorageRevision] = useState(0);

  useEffect(
    () => subscribeToBoardStorageReplaced(() => setStorageRevision((current) => current + 1)),
    [],
  );

  return {
    ...data,
    projectId,
    showLoading,
    boardId,
    localOnly,
    storageRevision,
    /** What the reads compare against: this board, at this revision of what is stored for it. */
    storedFor: `${boardId}:${storageRevision}`,
  };
}

export type BoardStore = ReturnType<typeof useBoardStore>;
