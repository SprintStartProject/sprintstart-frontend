import { useState } from "react";
import type { PoolStatusFilter } from "./poolRules";
import type { PoolView } from "./poolTypes";

/** The reader's picks — view, status tab, project scope, page — and the changes that reset the page. */
export function usePoolControls() {
  const [view, setView] = useState<PoolView>("cloud");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<PoolStatusFilter>("all");
  const [onlyProject, setOnlyProject] = useState(false);

  const changeView = (nextView: PoolView) => {
    setView(nextView);
    setPage(1);
  };
  const changeStatusFilter = (nextFilter: PoolStatusFilter) => {
    setStatusFilter(nextFilter);
    setPage(1);
  };
  const toggleOnlyProject = () => {
    setOnlyProject((current) => !current);
    setPage(1);
  };

  return {
    view,
    page,
    statusFilter,
    onlyProject,
    setPage,
    changeView,
    changeStatusFilter,
    toggleOnlyProject,
  };
}
