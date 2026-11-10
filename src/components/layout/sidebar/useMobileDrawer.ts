import { useCallback, useEffect, useState, type RefObject } from "react";
import { useLocation } from "react-router-dom";
import { SIDEBAR_TOGGLE_SHORTCUT, useShortcutListener } from "../../../features/shortcuts";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { useDialogFocus } from "../../ui/useDialogFocus";

type MobileDrawer = {
  isOpen: boolean;
  close: () => void;
  toggle: () => void;
};

/**
 * The mobile drawer's open state, its dialog focus, and the Alt+S chord that toggles whichever
 * sidebar is on screen: below `lg` the drawer, as the header's button does; from `lg` up the
 * desktop sidebar's fold to icons (`toggleDesktopFold`), as its logo does.
 *
 * Never the drawer on a wide screen: it is not on screen there, so the chord would flip state
 * nobody can see -- and leave it flipped, opening the drawer uninvited the next time the window
 * narrows. The drawer's ref comes first: a ref inside the returned object would be read during render.
 */
export function useMobileDrawer(
  toggleDesktopFold: () => void,
): readonly [RefObject<HTMLElement | null>, MobileDrawer] {
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();
  const isDesktopLayout = useMediaQuery("(min-width: 1024px)");

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((open) => !open), []);

  // A chord can change the route without any link being clicked (Alt+H — nothing runs
  // `onNavigate` then), and the drawer would still be standing open over the new page. Deferred to
  // a microtask so this is not a synchronous setState inside the effect body, which
  // `react-hooks/set-state-in-effect` rejects.
  useEffect(() => {
    void Promise.resolve().then(() => setIsOpen(false));
  }, [pathname]);

  // The drawer is a modal layer over the page: focus moves into it, Tab stays inside, Escape shuts
  // it and focus goes back to the button that opened it. Only while it is actually on screen -- a
  // flag left set after the window grew past `lg` must not trap a keyboard behind a hidden panel.
  const drawerRef = useDialogFocus<HTMLElement>(isOpen && !isDesktopLayout, close);

  useShortcutListener(SIDEBAR_TOGGLE_SHORTCUT, isDesktopLayout ? toggleDesktopFold : toggle);

  return [drawerRef, { isOpen, close, toggle }];
}
