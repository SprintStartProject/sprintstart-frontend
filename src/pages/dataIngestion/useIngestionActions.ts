import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { SectionKey, SourceChange } from "../../features/data-ingestion/types.ts";
import { queryKeys } from "../../services/queryKeys.ts";
import { getGithubPatNames } from "../../services/sources/githubService.ts";
import type { IngestionFeed } from "./useIngestionFeed";
import type { SourceSelection } from "./useSourceSelection";

type Args = {
  feed: IngestionFeed;
  selection: SourceSelection;
  showSection: (section: SectionKey) => void;
  reloadProjects: () => Promise<void> | void;
};

/**
 * Connecting a source, refreshing, and reacting to what the details panel changed.
 */
export function useIngestionActions({ feed, selection, showSection, reloadProjects }: Args) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const { refresh, polling } = feed;

  // The tokens the add-source form discovers repositories with. Only asked for once the modal is
  // open; a failure just leaves the list empty (the form loads its own).
  const { data: githubTokenNames = [] } = useQuery({
    queryKey: queryKeys.admin.githubTokenNames(),
    queryFn: ({ signal }) => getGithubPatNames(signal),
    enabled: isAddSourceOpen,
    retry: false,
  });

  return {
    isRefreshing,
    isAddSourceOpen,
    githubTokenNames,
    // The wizard covers both connect paths (org discovery and a single repository), so this is
    // the only entry point.
    openAddSource: () => setIsAddSourceOpen(true),
    closeAddSource: () => setIsAddSourceOpen(false),
    // Runs after the wizard connects a source: opens the polling window, jumps to the sources
    // list and reloads the page's data and the project switcher's (the modal owns the confirming
    // toast).
    onConnected: () => {
      polling.open();
      showSection("sources");

      void Promise.all([refresh(), reloadProjects()]);
    },
    onRefresh: async () => {
      setIsRefreshing(true);

      try {
        await Promise.all([refresh(), reloadProjects()]);
      } finally {
        setIsRefreshing(false);
      }
    },
    // The details panel runs its actions itself (through the source's connector definition) and
    // reports what it changed; this reloads what the cards are built from. An update also opens
    // the polling window, so the run it started shows up and the card moves from "Syncing" to
    // "Synced"; an unlink drops the selection, so the card disappears and the drawer closes.
    //
    // Deliberately does NOT reload the projects: the switcher's project list is unaffected by
    // these actions, and reloading it can transiently drop the selected project (a slow or
    // failed managed-projects fetch resets the selection), which reads as a project switch and
    // closes the open drawer.
    onSourceChanged: async (change: SourceChange) => {
      if (change === "updated") polling.open();
      if (change === "unlinked") selection.select(null);

      await refresh();
    },
  };
}
