import { useState, useEffect } from 'react';
import { Monitor, Moon, Sparkles, Sun, MousePointer2 } from 'lucide-react';
import { useTheme } from '../../../context/useTheme';
import type { Theme } from '../../../context/ThemeContext';

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'system', label: 'System', icon: Monitor },
    { value: 'dark', label: 'Dark', icon: Moon },
];

const BG_STORAGE_KEY = 'sprintstart:aurora-bg';
const HOVER_STORAGE_KEY = 'sprintstart:aurora-hover';

/** Reads a boolean preference from localStorage with a given default. */
function getBooleanPref(key: string, defaultValue: boolean): boolean {
    try {
        const stored = localStorage.getItem(key);
        if (stored !== null) {
            return stored === 'true';
        }
    } catch {
        // localStorage unavailable.
    }
    return defaultValue;
}

/**
 * Applies a :root class to <html> based on a preference boolean and persists it.
 * Returns the cleanup function to revert the class.
 */
function applyRootClass(key: string, className: string, enabled: boolean) {
    const root = document.documentElement;
    if (enabled) {
        root.classList.remove(className);
    } else {
        root.classList.add(className);
    }
    try {
        localStorage.setItem(key, enabled ? 'true' : 'false');
    } catch {
        // localStorage unavailable — just apply the class for this session.
    }
}

/**
 * Three-way theme preference control (Light / System / Dark) plus
 * independent toggles for Aurora Background and Interactive Spotlight.
 *
 * Bound to the global {@link ThemeContext}; selecting an option persists it
 * via the provider. Each option shows an icon and a text label (AGENTS.md §7 —
 * meaning never conveyed by colour alone).
 */
export function AppearanceSection() {
    const { theme, setTheme } = useTheme();
    const [bgEnabled, setBgEnabled] = useState<boolean>(() => getBooleanPref(BG_STORAGE_KEY, true));
    const [hoverEnabled, setHoverEnabled] = useState<boolean>(() => getBooleanPref(HOVER_STORAGE_KEY, true));

    useEffect(() => {
        applyRootClass(BG_STORAGE_KEY, 'aurora-bg-disabled', bgEnabled);
    }, [bgEnabled]);

    useEffect(() => {
        applyRootClass(HOVER_STORAGE_KEY, 'aurora-hover-disabled', hoverEnabled);
    }, [hoverEnabled]);

    return (
        <div className="flex flex-col gap-6">
            <div role="radiogroup" aria-label="Theme preference" className="flex flex-col gap-3 sm:flex-row">
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
                                'flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus',
                                isActive
                                    ? 'border-app-brand bg-app-brand-soft text-app-text'
                                    : 'border-app-border bg-app-bg text-app-text-muted hover:bg-app-surface-hover hover:text-app-text',
                            ].join(' ')}
                        >
                            <Icon className="h-4 w-4 shrink-0" aria-hidden />
                            {label}
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-app-border bg-app-bg p-4">
                <div className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-app-brand shrink-0" />
                    <div>
                        <div id="aurora-bg-title" className="text-sm font-medium text-app-text">Aurora Background</div>
                        <div className="text-xs text-app-text-muted">Animated ambient glow on page backgrounds.</div>
                    </div>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-label="Toggle Aurora Background"
                    aria-labelledby="aurora-bg-title"
                    aria-checked={bgEnabled}
                    onClick={() => setBgEnabled((v) => !v)}
                    className={[
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus',
                        bgEnabled ? 'bg-app-brand' : 'bg-app-border-strong',
                    ].join(' ')}
                >
                    <span
                        className={[
                            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                            bgEnabled ? 'translate-x-5' : 'translate-x-0',
                        ].join(' ')}
                    />
                </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-app-border bg-app-bg p-4">
                <div className="flex items-center gap-3">
                    <MousePointer2 className="h-4 w-4 text-app-brand shrink-0" />
                    <div>
                        <div id="aurora-hover-title" className="text-sm font-medium text-app-text">Interactive Spotlight</div>
                        <div className="text-xs text-app-text-muted">Cursor-following glow trail on page backgrounds.</div>
                    </div>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-label="Toggle Interactive Spotlight"
                    aria-labelledby="aurora-hover-title"
                    aria-checked={hoverEnabled}
                    onClick={() => setHoverEnabled((v) => !v)}
                    className={[
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus',
                        hoverEnabled ? 'bg-app-brand' : 'bg-app-border-strong',
                    ].join(' ')}
                >
                    <span
                        className={[
                            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                            hoverEnabled ? 'translate-x-5' : 'translate-x-0',
                        ].join(' ')}
                    />
                </button>
            </div>
        </div>
    );
}