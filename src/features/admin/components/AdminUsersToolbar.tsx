import { Check, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { USER_FILTER_OPTIONS } from "../data";
import type { UserFilter } from "../types";

type AdminUsersToolbarProps = {
    userCount: number;
    selectedUserCount: number;
    searchValue: string;
    userFilter: UserFilter;
    showFilters: boolean;
    onSearchChange: (value: string) => void;
    onFilterChange: (filter: UserFilter) => void;
    onToggleFilters: () => void;
    onRequestBulkDelete: () => void;
};

export function AdminUsersToolbar({
    userCount,
    selectedUserCount,
    searchValue,
    userFilter,
    showFilters,
    onSearchChange,
    onFilterChange,
    onToggleFilters,
    onRequestBulkDelete,
}: AdminUsersToolbarProps) {
    return (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-app-text">
                    {userCount} users
                </span>

                {selectedUserCount > 0 && (
                    <span className="text-sm text-app-brand-text">
                        {selectedUserCount} selected
                    </span>
                )}

                {selectedUserCount > 0 && (
                    <button
                        type="button"
                        onClick={onRequestBulkDelete}
                        className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-app-danger-bg bg-app-danger-bg px-3 text-sm font-medium text-app-danger-text transition-colors hover:bg-app-danger-solid hover:text-white"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete All
                    </button>
                )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-disabled" />
                    <input
                        value={searchValue}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search users..."
                        aria-label="Search users"
                        className="h-11 w-full rounded-xl border border-app-border bg-app-surface pl-10 pr-4 text-sm text-app-text outline-none placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
                    />
                </div>

                <div className="relative">
                    <button
                        type="button"
                        onClick={onToggleFilters}
                        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors sm:w-auto ${
                            userFilter !== "all"
                                ? "border-app-brand-border bg-app-brand-soft text-app-brand-text"
                                : "border-app-border bg-app-surface text-app-text hover:bg-app-surface-hover"
                        }`}
                        aria-haspopup="menu"
                        aria-expanded={showFilters}
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Filter
                    </button>

                    {showFilters && (
                        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-xl sm:left-auto sm:w-52">
                            {USER_FILTER_OPTIONS.map(({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => onFilterChange(value)}
                                    className={`flex min-h-11 w-full items-center justify-between px-4 py-3 text-sm transition-colors ${
                                        userFilter === value
                                            ? "bg-app-brand-soft text-app-brand-text"
                                            : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                                    }`}
                                >
                                    {label}
                                    {userFilter === value && (
                                        <Check className="h-3.5 w-3.5" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
