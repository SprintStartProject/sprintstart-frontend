import { Search, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { FilterSelect } from "../../../components/ui/FilterSelect";
import { USER_FILTER_OPTIONS } from "../data";
import type { UserFilter } from "../types";

type AdminUsersToolbarProps = {
    userCount: number;
    selectedUserCount: number;
    searchValue: string;
    userFilter: UserFilter;
    onSearchChange: (value: string) => void;
    onFilterChange: (filter: UserFilter) => void;
    onRequestBulkDelete: () => void;
};

export function AdminUsersToolbar({
    userCount,
    selectedUserCount,
    searchValue,
    userFilter,
    onSearchChange,
    onFilterChange,
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
                    <Button
                        variant="dangerSoft"
                        size="sm"
                        onClick={onRequestBulkDelete}
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                    >
                        Delete All
                    </Button>
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
                        className="h-11 w-full rounded-xl border border-app-border/70 bg-app-surface/70 pl-10 pr-4 text-sm text-app-text outline-none backdrop-blur-md transition-colors placeholder:text-app-text-disabled hover:border-app-brand-border-strong focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
                    />
                </div>

                <FilterSelect
                    label="Filter users"
                    value={userFilter}
                    options={USER_FILTER_OPTIONS}
                    onChange={onFilterChange}
                    className="w-full sm:w-52"
                />
            </div>
        </div>
    );
}
