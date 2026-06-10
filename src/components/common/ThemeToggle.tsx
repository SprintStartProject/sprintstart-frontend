import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/useTheme';

/**
 * Configuration options for the ThemeToggle component.
 */
interface ThemeToggleProps {
    /** Optional CSS class names for styling the outer button. */
    className?: string;
    /** Whether to show the text label ("Dark Mode" / "Light Mode") next to the icon. */
    showLabel?: boolean;
}

/**
 * A toggle switch component that allows users to alternate between light and dark themes.
 * 
 * Synchronizes with the global `ThemeContext` and provides visual feedback via 
 * icons (Sun/Moon) and a toggle switch animation.
 */
export function ThemeToggle({ className = '', showLabel = true }: ThemeToggleProps) {
    const { isDarkMode, toggleTheme } = useTheme();

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle light and dark mode"
            aria-pressed={isDarkMode}
            className={`flex h-[40px] items-center justify-between rounded-[8px] px-[12px] text-[14px] font-medium leading-none text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus ${className}`}
        >
            <span className="flex items-center gap-[12px]">
                {isDarkMode ? (
                    <Moon className="h-[16px] w-[16px] text-app-text-muted" />
                ) : (
                    <Sun className="h-[16px] w-[16px] text-app-text-muted" />
                )}

                {showLabel && (isDarkMode ? 'Dark Mode' : 'Light Mode')}
            </span>

            <span
                className={[
                    'flex h-[16px] w-[32px] items-center rounded-full p-[4px] transition-colors ml-4',
                    isDarkMode
                        ? 'justify-end bg-app-brand'
                        : 'justify-start bg-app-border-strong',
                ].join(' ')}
            >
                <span className="h-[8px] w-[8px] rounded-full bg-white" />
            </span>
        </button>
    );
}
