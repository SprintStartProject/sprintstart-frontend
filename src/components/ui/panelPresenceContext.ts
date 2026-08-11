import { createContext } from "react";

type PanelPresenceContextValue = {
  isOpen: boolean;
};

/**
 * Lets `SidePanel` learn that it is being closed even though its own props
 * still describe an open panel. `null` means "no presence wrapper", in which
 * case `SidePanel` falls back to its own `isOpen` prop.
 *
 * Lives in its own module because a context may not be exported from a file
 * that also exports components (`react-refresh/only-export-components`).
 */
export const PanelPresenceContext = createContext<PanelPresenceContextValue | null>(null);
