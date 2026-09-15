import { createContext } from "react";

/**
 * Whether a page has asked the app shell to get out of its way.
 *
 * Focus mode is one page saying "for now, I am the whole screen": the app sidebar, the buddy dock
 * and the page's own header band step aside, and the content takes the full width. It exists for
 * the board, where forty cards in a column with a 10rem gutter either side is a lot of scrolling
 * for a surface somebody keeps open all day.
 *
 * It lives in a context rather than in the page because the things that have to disappear are not
 * the page's to hide: the sidebar and the buddy widget are mounted by the app shell, one level
 * above the router. A page sets the flag; the shell decides what that means.
 *
 * Deliberately *not* the browser's fullscreen API. That one needs a user gesture, can be refused,
 * takes the tab bar and the address bar with it, and leaves people hunting for the way out. This is
 * the app making room for itself, and Escape or the same button undoes it.
 */
export type FocusModeContextType = {
  /** Whether the shell is currently out of the way. */
  isFocused: boolean;
  setFocused: (focused: boolean) => void;
  toggleFocused: () => void;
};

/** Accessed through the `useFocusMode` hook, which has defaults for use outside the provider. */
export const FocusModeContext = createContext<FocusModeContextType | undefined>(undefined);
