import { Key, Layers, Users } from "lucide-react";
import type { AdminTab } from "../types";

type TabSwitcherProps = {
    activeTab: AdminTab;
    onChange: (tab: AdminTab) => void;
};

export function TabSwitcher({ activeTab, onChange }: TabSwitcherProps) {
    return (
        <div className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-app-border bg-app-surface-muted p-1 sm:w-auto sm:flex">
            <button
                type="button"
                onClick={() => onChange("users")}
                className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors sm:gap-2 sm:px-4 sm:text-sm ${
                    activeTab === "users"
                        ? "bg-app-surface text-app-text shadow-sm"
                        : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                }`}
            >
                <Users className="h-4 w-4" />
                Users
            </button>

            <button
                type="button"
                onClick={() => onChange("projects")}
                className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors sm:gap-2 sm:px-4 sm:text-sm ${
                    activeTab === "projects"
                        ? "bg-app-surface text-app-text shadow-sm"
                        : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                }`}
            >
                <Layers className="h-4 w-4" />
                Projects
            </button>

            <button
                type="button"
                onClick={() => onChange("tokens")}
                className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors sm:gap-2 sm:px-4 sm:text-sm ${
                    activeTab === "tokens"
                        ? "bg-app-surface text-app-text shadow-sm"
                        : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                }`}
            >
                <Key className="h-4 w-4" />
                Tokens
            </button>
        </div>
    );
}
