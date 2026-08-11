import { Check } from "lucide-react";

type SelectionCheckboxProps = {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
};

export function SelectionCheckbox({ checked, onChange, ariaLabel }: SelectionCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all ${
        checked
          ? "border-app-brand bg-app-brand text-white shadow-sm shadow-app-brand-glow"
          : "border-app-border bg-app-surface hover:border-app-brand-border-strong hover:bg-app-brand-soft"
      }`}
    >
      {checked && <Check className="h-4 w-4 stroke-3" />}
    </button>
  );
}
