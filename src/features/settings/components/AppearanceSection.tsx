import type { ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { Gauge, Monitor, Moon, Pointer, Rocket, Sparkles, Sun } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { GLOW_INTENSITY_MAX, GLOW_INTENSITY_MIN } from "../../../context/ThemeContext";
import { useTheme } from "../../../context/useTheme";
import type { Theme } from "../../../context/ThemeContext";
import { useMoments } from "../../moments";
import { SettingsToggleRow } from "./SettingsToggleRow";

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

/** A titled group of related controls inside the Appearance section. */
function AppearanceGroup({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h3
        id={`${id}-title`}
        className="text-xs font-semibold tracking-wide text-app-text-subtle uppercase"
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * Everything about how SprintStart looks, in three groups: the theme preference
 * (Light / System / Dark), the visual effects (Aurora Background with its glow
 * intensity, Card Tilt) and optional extras (the rocket pet).
 *
 * Bound to the global {@link ThemeContext}; selecting an option persists it
 * via the provider. Each option shows an icon and a text label (AGENTS.md §7 —
 * meaning never conveyed by colour alone).
 *
 * The classic-mode notice is the only way out of `style-classic` in the whole app. The mode
 * turns itself on when the OS asks for reduced motion and CSS then hides the aurora layer
 * outright, so without this the Aurora Background switch below was a dead control: it flipped,
 * it persisted, and nothing ever appeared — with nothing on screen saying why.
 *
 * What the notice *says* is decided by a live `useReducedMotion()` rather than by classic mode
 * itself. The two come apart: turning the OS setting back off does not revert a mode that has
 * been persisted, and the notice would then be explaining the state of a system preference
 * that no longer holds.
 *
 * The rocket pet is off by default (Aug 2026): a novelty like this should be something people
 * opt into from here, not something everyone has to notice in the corner of every page and
 * dismiss. Further decorative extras belong in the same group.
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
    isClassicMode,
    setStyleMode,
  } = useTheme();
  const { showRocketPet, setShowRocketPet } = useMoments();

  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-8">
      <AppearanceGroup id="appearance-theme" title="Theme">
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
      </AppearanceGroup>

      <AppearanceGroup id="appearance-effects" title="Effects & animations">
        {isClassicMode && (
          <div className="flex flex-col gap-3 rounded-xl border border-app-warning-border bg-app-warning-bg p-4 text-app-warning-text sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Gauge className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-medium">Animations are turned off</p>
                <p className="mt-1 text-xs leading-relaxed">
                  {prefersReducedMotion
                    ? "Your system asks for reduced motion, so SprintStart is running in its calm style and the animated background below stays hidden whichever way its switch is set."
                    : "SprintStart is running in its calm style, so the animated background below stays hidden whichever way its switch is set."}
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStyleMode("ultra")}
              className="shrink-0"
            >
              Turn animations on
            </Button>
          </div>
        )}

        <SettingsToggleRow
          id="aurora-toggle"
          icon={Sparkles}
          title="Aurora Background"
          description={
            <>
              Animated ambient glow and cursor spotlight on page backgrounds.
              {isClassicMode && " Currently hidden — SprintStart is in its calm style."}
            </>
          }
          checked={isAuroraEnabled}
          onCheckedChange={setIsAuroraEnabled}
        >
          {isAuroraEnabled && (
            <>
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
                // Without this a screen reader announces a bare "50"; the visible
                // readout carries the unit, so the slider must too.
                aria-valuetext={`${glowIntensity}%`}
                onChange={(event) => setGlowIntensity(event.target.valueAsNumber)}
                // Native control tinted with the brand colour — deliberately no
                // custom track CSS until a second slider justifies extracting one.
                className="mt-2 w-full cursor-pointer rounded-full accent-app-brand focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
              />
              <p className="mt-1 text-xs text-app-text-muted">
                Size and brightness of the glow that follows your mouse.
              </p>
            </>
          )}
        </SettingsToggleRow>

        <SettingsToggleRow
          id="tilt-toggle"
          icon={Pointer}
          title="Card Tilt Effect"
          description="3D perspective tilt and spotlight glow when hovering over cards."
          checked={isTiltEnabled}
          onCheckedChange={setIsTiltEnabled}
        />
      </AppearanceGroup>

      <AppearanceGroup id="appearance-extras" title="Extras">
        <SettingsToggleRow
          id="rocket-pet-toggle"
          icon={Rocket}
          title="Rocket Pet"
          description="A little rocket that hides in the bottom-right corner of every page and can be launched for fun. Off by default."
          checked={showRocketPet}
          onCheckedChange={setShowRocketPet}
        />
      </AppearanceGroup>
    </div>
  );
}
