import { useEffect, type ComponentPropsWithRef } from "react";
import {
  claimPendingMainContentFocus,
  MAIN_CONTENT_ID,
  MAIN_PLACEHOLDER_ATTRIBUTE,
} from "./mainFocus";

type MainContentProps = ComponentPropsWithRef<"main"> & {
  /**
   * For a loading skeleton. It is still the page's `<main>` landmark, but it must not take a
   * pending focus request: the real page replaces it a moment later and focus would be lost.
   */
  placeholder?: boolean;
};

/**
 * The one `<main>` landmark of a route.
 *
 * Every routed page renders exactly one, and this is the only way to do it: the app shell around
 * the routes is a plain `div` (nested `<main>` landmarks are invalid and confuse screen readers).
 * It carries {@link MAIN_CONTENT_ID} so the skip link can reach it, and `tabIndex={-1}` so it can
 * take focus from script. It is not a control, so it shows no outline of its own.
 */
export function MainContent({ placeholder = false, className = "", ...props }: MainContentProps) {
  useEffect(() => {
    if (!placeholder) claimPendingMainContentFocus();
  }, [placeholder]);

  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      {...{ [MAIN_PLACEHOLDER_ATTRIBUTE]: placeholder ? "" : undefined }}
      className={`focus-visible:outline-hidden ${className}`.trim()}
      {...props}
    />
  );
}
