import { forwardRef, type InputHTMLAttributes } from "react";
import { Check } from "lucide-react";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Native checkbox with the shared app styling and an explicit check glyph.
 *
 * The input remains the interactive element, preserving browser and screen-reader
 * semantics while the adjacent glyph provides a consistent visual treatment.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className = "", disabled, ...props },
  ref,
) {
  return (
    <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        disabled={disabled}
        className={`peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-md border border-app-border-strong bg-app-surface transition-all checked:border-app-brand checked:bg-app-brand hover:border-app-brand-border-strong hover:bg-app-brand-soft checked:hover:bg-app-brand focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:ring-offset-1 focus-visible:ring-offset-app-surface focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        {...props}
      />
      <Check
        aria-hidden="true"
        className="pointer-events-none relative h-3.5 w-3.5 scale-75 stroke-3 text-white opacity-0 transition-all peer-checked:scale-100 peer-checked:opacity-100"
      />
    </span>
  );
});
