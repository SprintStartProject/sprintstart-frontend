import { useCallback, useState } from "react";

const NO_IDS: ReadonlySet<string> = new Set();

interface ScopedSelection {
  scope: string;
  ids: ReadonlySet<string>;
}

/**
 * Select mode and the ticked artifact ids for the Knowledge Base bulk delete.
 *
 * The selection is tied to `scopeKey` — the identity of the list on screen
 * (filters, page, size, sort). When the key changes the selection reads as
 * empty in that same render, without an effect: a selection
 * that survives a filter or page change is a trap, because the reader can no
 * longer see what they are about to delete. `clear` covers the cases the key
 * cannot see (refresh, a finished delete).
 *
 * Leaving select mode clears too, so re-entering never resurrects old ticks.
 */
export function useUploadSelection(scopeKey: string) {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selection, setSelection] = useState<ScopedSelection>({ scope: scopeKey, ids: NO_IDS });

  // The documented "adjust state while rendering" pattern: a new scope drops the old ticks for
  // good, so returning to the previous page does not resurrect them.
  if (selection.scope !== scopeKey) setSelection({ scope: scopeKey, ids: NO_IDS });

  const selectedIds = selection.scope === scopeKey ? selection.ids : NO_IDS;

  const toggle = useCallback(
    (id: string) =>
      setSelection((previous) => {
        const ids = new Set(previous.scope === scopeKey ? previous.ids : NO_IDS);
        if (ids.has(id)) ids.delete(id);
        else ids.add(id);
        return { scope: scopeKey, ids };
      }),
    [scopeKey],
  );

  const clear = useCallback(() => setSelection({ scope: scopeKey, ids: NO_IDS }), [scopeKey]);

  const setSelectMode = useCallback(
    (on: boolean) => {
      setIsSelectMode(on);
      if (!on) clear();
    },
    [clear],
  );

  return { isSelectMode, setSelectMode, selectedIds, toggle, clear };
}
