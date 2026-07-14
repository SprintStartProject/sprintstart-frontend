type AccountEnabledToggleProps = {
    enabled: boolean;
    disabled: boolean;
    ariaLabel?: string;
    onChange: (enabled: boolean) => void;
};

export function AccountEnabledToggle({
                                         enabled,
                                         disabled,
                                         ariaLabel = "Toggle account access",
                                         onChange,
                                     }: AccountEnabledToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-label={ariaLabel}
            aria-checked={enabled}
            disabled={disabled}
            onClick={() => onChange(!enabled)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-brand-glow disabled:cursor-not-allowed disabled:opacity-60 ${
                enabled
                    ? "border-app-success-border bg-app-success-solid"
                    : "border-app-border-strong bg-app-neutral-bg"
            }`}
        >
            <span
                className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    enabled ? "translate-x-6" : "translate-x-1"
                }`}
            />
        </button>
    );
}
