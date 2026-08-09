import { useId, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { SelectionCheckbox } from "./SelectionCheckbox";
import { getDisplayName } from "../data";
import type { AdminUser } from "../types";

type MemberPickerProps = {
  users: AdminUser[];
  selectedUserIds: Set<string>;
  onToggleUser: (userId: string) => void;
  /** Receives the users the filter currently shows, not the whole directory. */
  onToggleVisible: (visibleUsers: AdminUser[], allSelected: boolean) => void;
  disabled?: boolean;
  /** Rendered above the list, e.g. to explain what the selection is for. */
  label?: string;
};

/**
 * Multi-select over the user directory.
 *
 * The whole list is shown from the start and search only narrows it, rather
 * than the picker staying empty until something is typed: an admin assigning
 * people to a new project usually wants to pick several of them off a list, not
 * recall names one at a time. "Select all" therefore acts on what is currently
 * visible, which makes the search box double as a bulk-selection tool.
 */
export function MemberPicker({
  users,
  selectedUserIds,
  onToggleUser,
  onToggleVisible,
  disabled = false,
  label = "Members",
}: MemberPickerProps) {
  const searchInputId = useId();
  const [search, setSearch] = useState("");

  const visibleUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const sorted = [...users].sort((left, right) =>
      getDisplayName(left).localeCompare(getDisplayName(right)),
    );

    if (normalized.length === 0) return sorted;

    return sorted.filter((user) =>
      [getDisplayName(user), user.username, user.email].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [search, users]);

  const allVisibleSelected =
    visibleUsers.length > 0 &&
    visibleUsers.every((user) => selectedUserIds.has(user.id));

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label
          htmlFor={searchInputId}
          className="block text-sm text-app-text-muted"
        >
          {label}
        </label>
        <span className="text-xs text-app-text-muted">
          {selectedUserIds.size} selected
        </span>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-disabled"
          aria-hidden="true"
        />
        <input
          id={searchInputId}
          type="search"
          value={search}
          disabled={disabled}
          placeholder="Filter by name, username or email"
          onChange={(event) => setSearch(event.target.value)}
          className="h-11 w-full rounded-xl border border-app-border bg-app-surface pl-9 pr-3 text-sm font-medium text-app-text outline-none transition-colors placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {visibleUsers.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onToggleVisible(visibleUsers, allVisibleSelected)}
          className="mt-2"
        >
          {allVisibleSelected
            ? "Clear these"
            : `Select these ${visibleUsers.length}`}
        </Button>
      )}

      <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-app-border">
        {visibleUsers.length === 0 ? (
          <li className="flex items-center gap-2 px-3 py-4 text-sm text-app-text-muted">
            <Users className="h-4 w-4" aria-hidden="true" />
            {users.length === 0 ? "No users available." : "No user matches."}
          </li>
        ) : (
          visibleUsers.map((user) => {
            const displayName = getDisplayName(user);
            const isSelected = selectedUserIds.has(user.id);

            return (
              <li
                key={user.id}
                className="flex items-center gap-3 border-b border-app-border px-3 py-2 last:border-b-0"
              >
                <SelectionCheckbox
                  checked={isSelected}
                  onChange={() => !disabled && onToggleUser(user.id)}
                  ariaLabel={`Add ${displayName} to the project`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-app-text">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-app-text-muted">
                    {user.email}
                  </p>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
