import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Key, Layers, Users, type LucideIcon } from "lucide-react";
import {
    dockMagnifySpringToken,
    slidingIndicatorSpringToken,
} from "../../../styles/tokens";
import type { AdminTab } from "../types";

/** Matches the section filter on the Data Ingestion page. */
const TAB_HOVER_SCALE = 1.06;

const TABS: { key: AdminTab; label: string; icon: LucideIcon }[] = [
    { key: "users", label: "Users", icon: Users },
    { key: "projects", label: "Projects", icon: Layers },
    { key: "tokens", label: "Tokens", icon: Key },
];

type TabSwitcherProps = {
    activeTab: AdminTab;
    onChange: (tab: AdminTab) => void;
};

/**
 * Section navigation for the Access Management page.
 *
 * Motion matches the sidebar and the Data Ingestion section filter: the hovered
 * tab magnifies, and the active fill is a single shared element that slides
 * between tabs rather than blinking from one to the next.
 */
export function TabSwitcher({ activeTab, onChange }: TabSwitcherProps) {
    const [hoveredTab, setHoveredTab] = useState<AdminTab | null>(null);
    const prefersReducedMotion = useReducedMotion();

    return (
        <div
            onMouseLeave={() => setHoveredTab(null)}
            // `p-1` is what the magnified tab grows into; the row has no
            // overflow of its own, so this is only about not touching the edge.
            className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-app-border/70 bg-app-surface-muted/70 p-1 backdrop-blur-md sm:flex sm:w-auto"
        >
            {TABS.map(({ key, label, icon: Icon }) => {
                const isActive = activeTab === key;
                const isMagnified = !prefersReducedMotion && hoveredTab === key;

                return (
                    <motion.button
                        key={key}
                        type="button"
                        onClick={() => onChange(key)}
                        onHoverStart={() => setHoveredTab(key)}
                        onHoverEnd={() =>
                            setHoveredTab((current) => (current === key ? null : current))
                        }
                        animate={{ scale: isMagnified ? TAB_HOVER_SCALE : 1 }}
                        transition={dockMagnifySpringToken}
                        className={`group relative inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus sm:gap-2 sm:px-4 sm:text-sm ${
                            isActive
                                ? "text-app-text"
                                : "text-app-text-muted hover:text-app-text"
                        }`}
                    >
                        {isActive ? (
                            <motion.span
                                aria-hidden="true"
                                layoutId="admin-tab-pill"
                                transition={
                                    prefersReducedMotion
                                        ? { duration: 0 }
                                        : slidingIndicatorSpringToken
                                }
                                className="absolute inset-0 rounded-xl bg-app-surface shadow-sm"
                            />
                        ) : (
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 rounded-xl bg-app-surface-hover opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100"
                            />
                        )}

                        <Icon className="relative z-10 h-4 w-4" />
                        <span className="relative z-10">{label}</span>
                    </motion.button>
                );
            })}
        </div>
    );
}
