import { Monitor, Moon, Pointer, Sparkles, Sun } from "lucide-react";
import { GLOW_INTENSITY_MAX, GLOW_INTENSITY_MIN } from "../../../context/ThemeProvider";
import { useTheme } from "../../../context/useTheme";
import type { Theme } from "../../../context/ThemeContext";

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

/**
 * Three-way theme preference control (Light / System / Dark) plus
 * an Aurora Background toggle.
 *
 * Bound to the global {@link ThemeContext}; selecting an option persists it
 * via the provider. Each option shows an icon and a text label (AGENTS.md §7 —
 * meaning never conveyed by colour alone).
 */
export function AppearanceSection() {
  const {
    theme,
    setTheme,
    isAuroraEnabled,
    setIsAuroraEnabled,
    glowIntensity,
    setGlowIntensity,
    isTiltEnabled,
    setIsTiltEnabled,
  } = useTheme();

  return (
    <div className="flex flex-col gap-6">
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

      <div className="rounded-xl border border-app-border bg-app-bg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0 text-app-brand" />
            <div>
              <div id="aurora-toggle-title" className="text-sm font-medium text-app-text">
                Aurora Background
              </div>
              <div className="text-xs text-app-text-muted">
                Animated ambient glow and cursor spotlight on page backgrounds.
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-labelledby="aurora-toggle-title"
            aria-checked={isAuroraEnabled}
            onClick={() => setIsAuroraEnabled(!isAuroraEnabled)}
            className={[
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none",
              isAuroraEnabled ? "bg-app-brand" : "bg-app-border-strong",
            ].join(" ")}
          >
            <span
              className={[
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                isAuroraEnabled ? "translate-x-5" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>

        {isAuroraEnabled && (
          <div className="mt-4 border-t border-app-border pt-4">
            <div className="flex items-center justify-between">
              <label
                id="glow-intensity-label"
                htmlFor="glow-intensity-slider"
                className="text-sm font-medium text-app-text"
              >
                Glow intensity
              </label>
              {/* tabular-nums so the number doesn't wiggle while dragging. */}
              <span className="text-sm text-app-text-muted tabular-nums">{glowIntensity}%</span>
            </div>
            <input
              id="glow-intensity-slider"
              type="range"
              min={GLOW_INTENSITY_MIN}
              max={GLOW_INTENSITY_MAX}
              step={1}
              value={glowIntensity}
              aria-labelledby="glow-intensity-label"
              onChange={(event) => setGlowIntensity(event.target.valueAsNumber)}
              // Native control tinted with the brand colour — deliberately no
              // custom track CSS until a second slider justifies extracting one.
              className="mt-2 w-full cursor-pointer rounded-full accent-app-brand focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
            />
            <p className="mt-1 text-xs text-app-text-muted">
              Size and brightness of the glow that follows your mouse.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-app-border bg-app-bg p-4">
        <div className="flex items-center gap-3">
          <Pointer className="h-4 w-4 shrink-0 text-app-brand" />
          <div>
            <div id="tilt-toggle-title" className="text-sm font-medium text-app-text">
              Card Tilt Effect
            </div>
            <div className="text-xs text-app-text-muted">
              3D perspective tilt and spotlight glow when hovering over cards.
            </div>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-labelledby="tilt-toggle-title"
          aria-checked={isTiltEnabled}
          onClick={() => setIsTiltEnabled(!isTiltEnabled)}
          className={[
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none",
            isTiltEnabled ? "bg-app-brand" : "bg-app-border-strong",
          ].join(" ")}
        >
          <span
            className={[
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
              isTiltEnabled ? "translate-x-5" : "translate-x-0",
            ].join(" ")}
          />
        </button>
      </div>
    </div>
  );
}
