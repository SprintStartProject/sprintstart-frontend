import { useId } from "react";

type EditableDetailRowProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: "text" | "email";
    autoComplete?: string;
};

export function EditableDetailRow({
    label,
    value,
    onChange,
    type = "text",
    autoComplete,
}: EditableDetailRowProps) {
    const id = useId();
    return (
        <div className="grid grid-cols-[7.5rem_1fr] items-center gap-4 py-2.5">
            <label htmlFor={id} className="text-sm text-app-text-muted">{label}</label>
            <input
                id={id}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                autoComplete={autoComplete}
                className="h-10 w-full rounded-xl border border-app-border bg-app-surface px-3 text-sm font-medium text-app-text outline-none transition-colors placeholder:text-app-text-disabled focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
            />
        </div>
    );
}
