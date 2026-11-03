import { useCallback, useState } from "react";
import { RAIL_DESKTOP_QUERY } from "../../components/layout/ConversationRail";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useRailOverlayGuard } from "../../hooks/useRailOverlayGuard";
import { readRailOpen, writeRailOpen } from "./railPreference";

type BuddyRail = {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
};

/**
 * Whether the conversations rail is open, and the remembered choice behind it.
 *
 * Below `md` the rail is a drawer over the conversation, so it never opens by itself there: the
 * stored preference is honoured only where the rail is a column beside the conversation. Restoring
 * it on a phone would put the hire behind their own conversation list on every visit. Nothing else
 * opens the rail on the hire's behalf either — what came back from the PM announces itself with the
 * header button's badge.
 */
export function useBuddyRail(): BuddyRail {
  const isDesktop = useMediaQuery(RAIL_DESKTOP_QUERY);
  const [rail, setRail] = useState(() => ({ open: (readRailOpen() ?? false) && isDesktop }));

  // The same rule the initial state applies, for the window narrowing after load. Not through
  // `setOpen`: this is the column failing to fit, not the hire choosing, so it neither writes the
  // preference through nor counts as having decided.
  useRailOverlayGuard(!isDesktop, () =>
    setRail((current) => (current.open ? { ...current, open: false } : current)),
  );

  // Written through as they choose, but only from the column, which is the width it is honoured at:
  // below `md` the rail is a drawer opened to read one answer, not a statement about the layout.
  const setOpen = useCallback(
    (open: boolean) => {
      if (isDesktop) writeRailOpen(open);
      setRail({ open });
    },
    [isDesktop],
  );

  return { isOpen: rail.open, setOpen };
}
