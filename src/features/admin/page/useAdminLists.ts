import { useMemo, useState } from "react";
import {
  filterAdminProjects,
  filterAdminUsers,
  filterSkills,
  getPaginatedProjects,
  getPaginatedSkills,
  getPaginatedUsers,
  getSafePage,
  getSkillCategories,
  getTotalPages,
} from "../data";
import type {
  AdminUser,
  ProjectFilter,
  ProjectOverview,
  Skill,
  SkillStatusFilter,
  UserFilter,
} from "../types";

/**
 * These live on the page, not in their tabs: only one tab is mounted at a time, so a search kept
 * inside a tab would reset every time you leave and come back. Changing a search or a filter
 * goes back to the first page.
 */
export function useUserList(users: AdminUser[]) {
  const [search, setSearchValue] = useState("");
  const [filter, setFilterValue] = useState<UserFilter>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => filterAdminUsers(users, search, filter), [users, search, filter]);
  const totalPages = getTotalPages(filtered.length);
  const safePage = getSafePage(page, totalPages);
  const paginated = useMemo(() => getPaginatedUsers(filtered, safePage), [filtered, safePage]);

  return {
    search,
    filter,
    filtered,
    paginated,
    totalPages,
    safePage,
    setPage,
    setSearch: (value: string) => {
      setSearchValue(value);
      setPage(1);
    },
    setFilter: (value: UserFilter) => {
      setFilterValue(value);
      setPage(1);
    },
  };
}

export function useProjectList(projects: ProjectOverview[]) {
  const [search, setSearchValue] = useState("");
  const [filter, setFilterValue] = useState<ProjectFilter>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => filterAdminProjects(projects, search, filter),
    [projects, search, filter],
  );
  const totalPages = getTotalPages(filtered.length);
  const safePage = getSafePage(page, totalPages);
  const paginated = useMemo(() => getPaginatedProjects(filtered, safePage), [filtered, safePage]);

  return {
    search,
    filter,
    filtered,
    paginated,
    totalPages,
    safePage,
    isFiltered: search.trim().length > 0 || filter !== "all",
    setPage,
    setSearch: (value: string) => {
      setSearchValue(value);
      setPage(1);
    },
    setFilter: (value: ProjectFilter) => {
      setFilterValue(value);
      setPage(1);
    },
    /** Back to the whole list, as when a project is opened from a user's drawer. */
    reset: () => {
      setSearchValue("");
      setFilterValue("all");
      setPage(1);
    },
  };
}

export function useSkillList(pool: Skill[]) {
  const [search, setSearchValue] = useState("");
  const [status, setStatusValue] = useState<SkillStatusFilter>("all");
  const [category, setCategoryValue] = useState("all");
  const [role, setRoleValue] = useState("all");
  const [page, setPage] = useState(1);

  const categories = useMemo(() => getSkillCategories(pool), [pool]);
  const filtered = useMemo(
    () => filterSkills(pool, search, status, category, role),
    [pool, search, status, category, role],
  );
  const totalPages = getTotalPages(filtered.length);
  const safePage = getSafePage(page, totalPages);
  const paginated = useMemo(() => getPaginatedSkills(filtered, safePage), [filtered, safePage]);
  return {
    search,
    status,
    category,
    role,
    categories,
    filtered,
    paginated,
    totalPages,
    safePage,
    hasSearch: search.trim().length > 0,
    setPage,
    setSearch: (value: string) => {
      setSearchValue(value);
      setPage(1);
    },
    setStatus: (value: SkillStatusFilter) => {
      setStatusValue(value);
      setPage(1);
    },
    setCategory: (value: string) => {
      setCategoryValue(value);
      setPage(1);
    },
    setRole: (value: string) => {
      setRoleValue(value);
      setPage(1);
    },
  };
}
