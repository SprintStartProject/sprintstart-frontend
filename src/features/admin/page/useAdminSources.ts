import { useEffect, useMemo } from "react";
import { useAuth } from "../../../context/useAuth";
import { useAdminData } from "../hooks/useAdminData";
import { useSkillPool } from "../hooks/useSkillPool";
import { visibleAdminTabs } from "./pageRules";
import { useProjectList, useSkillList, useUserList } from "./useAdminLists";
import { useTabHandoff } from "./useTabHandoff";
import { useState } from "react";

/**
 * What the page shows (the tokens tab starts on the given source filter): the visible tabs and the active one, the loaded users, projects and skills,
 * and the search, filter and page of each list.
 */
export function useAdminSources(initialAccessSourceFilter: string) {
  const { profile } = useAuth();
  const tabs = useMemo(() => visibleAdminTabs(profile?.permissionGroup), [profile]);
  const handoff = useTabHandoff(tabs);
  const data = useAdminData();
  const pool = useSkillPool();
  const { loadSkillPool } = pool;
  const { activeTab } = handoff;

  // Lazy, like the tokens section: only fetched once this tab is actually opened. `loadSkillPool`
  // itself no-ops on repeat calls unless forced, so switching back to the tab later does not
  // refetch.
  useEffect(() => {
    if (activeTab === "skills") void loadSkillPool();
  }, [activeTab, loadSkillPool]);

  // Lives here, not in the tokens section, for the same reason as the lists: only one tab is
  // mounted at a time, so a filter kept inside a section would reset every time you leave and
  // come back.
  const [accessSourceFilter, setAccessSourceFilter] = useState<string>(initialAccessSourceFilter);

  return {
    profile,
    tabs,
    handoff,
    data,
    pool,
    userList: useUserList(data.users),
    projectList: useProjectList(data.projects),
    skillList: useSkillList(pool.skills),
    accessSourceFilter,
    setAccessSourceFilter,
  };
}

export type AdminSources = ReturnType<typeof useAdminSources>;
