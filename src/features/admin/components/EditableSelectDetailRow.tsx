import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type EditableSelectDetailRowProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
};

export function EditableSelectDetailRow({
  label,
  value,
  onChange,
  options,
}: EditableSelectDetailRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const labelId = useId();

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: globalThis.MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectOption = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className="grid grid-cols-1 items-center gap-1.5 py-2.5 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
      <span id={labelId} className="text-sm text-app-text-muted">
        {label}
      </span>

      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className={`flex h-10 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm font-medium transition-colors outline-none focus:ring-2 focus:ring-app-brand-glow ${
            isOpen
              ? "border-app-brand-border bg-app-brand-soft text-app-brand-text"
              : "border-app-border bg-app-surface text-app-text hover:bg-app-surface-hover"
          }`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={labelId}
        >
          <span className="truncate">{value}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div
            role="listbox"
            aria-labelledby={labelId}
            className="absolute right-0 left-0 z-30 mt-2 overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-lg"
          >
            {options.map((option) => {
              const isSelected = option === value;

              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectOption(option)}
                  className={`flex min-h-11 w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-app-brand-soft text-app-brand-text"
                      : "text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                  }`}
                >
                  {option}
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
