import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../../../context/useTheme";
import type { Theme } from "../../../context/ThemeContext";

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

/**
 * Three-way theme preference control (Light / System / Dark).
 * Bound to the global {@link ThemeContext}; selecting an option persists it
 * via the provider. Each option shows an icon and a text label (AGENTS.md §7 —
 * meaning never conveyed by colour alone).
 */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme preference"
      className="flex flex-col gap-3 sm:flex-row"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            data-testid={`theme-option-${value}`}
            onClick={() => setTheme(value)}
            className={[
              "flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none",
              isActive
                ? "border-app-brand bg-app-brand-soft text-app-text"
                : "border-app-border bg-app-bg text-app-text-muted hover:bg-app-surface-hover hover:text-app-text",
            ].join(" ")}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
