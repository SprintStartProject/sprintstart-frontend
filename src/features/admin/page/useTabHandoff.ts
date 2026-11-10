import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AdminTab } from "../types";
import {
  handedOffKeys,
  initialAdminTab,
  readDeepLink,
  requestedAdminTab,
  type DeepLink,
} from "./pageRules";

/**
 * The tab the page is on, and what the URL asked for.
 *
 * `?tab=` opens the page on that section: the dashboard's Projects card links here, and without it
 * a card about projects dropped the reader on a list of people. It is a hand-off, not a permanent
 * part of the URL: it seeds the tab and is then stripped, so the tab bar keeps behaving as before
 * and the back button does not turn into a step-through of sections. It is consumed whenever it
 * arrives, not only on mount: the buddy links to `/admin?tab=projects` in place, and somebody
 * already on this page would otherwise keep their tab while the parameter sat in the URL.
 *
 * `?projectId=` and `?userId=` open that project's or user's drawer, so a link from elsewhere can
 * land on the thing it talks about. They are handed off only on mount: the drawer logic assumes no
 * drawer is open yet.
 */
export function useTabHandoff(tabs: AdminTab[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingDeepLink, setPendingDeepLink] = useState<DeepLink | null>(() =>
    readDeepLink(searchParams),
  );
  const requestedTab = requestedAdminTab(searchParams, tabs);
  const [activeTab, setActiveTab] = useState<AdminTab>(() =>
    initialAdminTab(requestedTab, searchParams),
  );
  // Adjusted during render rather than in the effect below: the tab follows a new request in the
  // same paint, and forgetting the request once stripped lets the same link work twice.
  const [handledTab, setHandledTab] = useState(requestedTab);
  if (requestedTab !== handledTab) {
    setHandledTab(requestedTab);
    if (requestedTab) setActiveTab(requestedTab);
  }

  const drawerParamsConsumed = useRef(false);

  useEffect(() => {
    const handedOff = handedOffKeys(searchParams, drawerParamsConsumed.current);
    drawerParamsConsumed.current = true;
    if (handedOff.length === 0) return;

    const next = new URLSearchParams(searchParams);
    handedOff.forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return { activeTab, setActiveTab, pendingDeepLink, setPendingDeepLink };
}
