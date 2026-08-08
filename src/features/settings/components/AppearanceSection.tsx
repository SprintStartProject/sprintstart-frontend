import { Monitor, Moon, Sparkles, Sun } from 'lucide-react';
import { useTheme } from '../../../context/useTheme';
import type { Theme } from '../../../context/ThemeContext';

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'system', label: 'System', icon: Monitor },
    { value: 'dark', label: 'Dark', icon: Moon },
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
    const { theme, setTheme, isAuroraEnabled, setIsAuroraEnabled } = useTheme();

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
                        <div id="aurora-toggle-title" className="text-sm font-medium text-app-text">Aurora Background</div>
                        <div className="text-xs text-app-text-muted">Animated ambient glow and cursor spotlight on page backgrounds.</div>
                    </div>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-label="Toggle Aurora Background"
                    aria-labelledby="aurora-toggle-title"
                    aria-checked={isAuroraEnabled}
                    onClick={() => setIsAuroraEnabled(!isAuroraEnabled)}
                    className={[
                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus',
                        isAuroraEnabled ? 'bg-app-brand' : 'bg-app-border-strong',
                    ].join(' ')}
                >
                    <span
                        className={[
                            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                            isAuroraEnabled ? 'translate-x-5' : 'translate-x-0',
                        ].join(' ')}
                    />
                </button>
            </div>
        </div>
    );
}