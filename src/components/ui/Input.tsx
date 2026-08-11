import { forwardRef, useContext } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { FieldContext } from "./fieldContext";
import { fieldClasses, leadingIconPosition, trailingPosition, type FieldSize } from "./fieldStyles";

type InputOwnProps = {
  size?: FieldSize;
  /**
   * Decorative icon shown inside the left edge. Pass the element:
   * `icon={<Search className="h-4 w-4" />}`. It is marked `aria-hidden` and
   * click-through, so it never steals focus from the field.
   */
  icon?: ReactNode;
  /**
   * Interactive element pinned inside the right edge — a clear button, a
   * password toggle, a refresh action. Unlike `icon` it stays clickable.
   */
  trailing?: ReactNode;
  /**
   * Marks the field as failing validation. Sets `aria-invalid` and switches
   * the border to danger. Inside a `Field` this is inherited from the error
   * prop and does not need to be passed.
   */
  invalid?: boolean;
};

export type InputProps = InputOwnProps & Omit<InputHTMLAttributes<HTMLInputElement>, "size">;

/**
 * The app's single-line text control.
 *
 * Height, radius, border, focus ring, placeholder color and disabled treatment
 * come from the shared field style, so an `Input` and a `Button` of the same
 * `size` are exactly the same height and agree on their focus ring.
 *
 * On its own it is a plain labelled-by-you input. Wrapped in a `Field` it also
 * picks up the generated `id`, the `aria-describedby` for hint and error text,
 * and the invalid state — none of which the caller has to wire by hand:
 *
 * ```tsx
 * <Field label="Token name" error={nameError}>
 *     <Input value={name} onChange={(e) => setName(e.target.value)} />
 * </Field>
 *
 * <Input
 *     size="sm"
 *     icon={<Search className="h-4 w-4" />}
 *     aria-label="Search users"
 *     placeholder="Search users…"
 * />
 * ```
 *
 * Not for checkboxes, radios or file pickers — those are different controls
 * with a different anatomy, and forcing them through this box would only give
 * them the wrong height.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = "md",
    icon,
    trailing,
    invalid,
    className = "",
    id,
    disabled,
    "aria-describedby": ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const field = useContext(FieldContext);

  const isInvalid = invalid ?? field?.invalid ?? false;
  const resolvedId = id ?? field?.controlId;
  const resolvedDescribedBy = ariaDescribedBy ?? field?.describedBy;
  const isDisabled = disabled ?? field?.disabled ?? false;

  const control = (
    <input
      ref={ref}
      id={resolvedId}
      disabled={isDisabled}
      aria-invalid={isInvalid || undefined}
      aria-describedby={resolvedDescribedBy}
      className={fieldClasses({
        size,
        invalid: isInvalid,
        hasLeadingIcon: Boolean(icon),
        hasTrailing: Boolean(trailing),
        className,
      })}
      {...rest}
    />
  );

  if (!icon && !trailing) return control;

  return (
    <div className="relative w-full">
      {icon && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-app-text-disabled ${leadingIconPosition[size]}`}
        >
          {icon}
        </span>
      )}

      {control}

      {trailing && (
        <span className={`absolute top-1/2 -translate-y-1/2 ${trailingPosition[size]}`}>
          {trailing}
        </span>
      )}
    </div>
  );
});
