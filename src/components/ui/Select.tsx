import { forwardRef, useContext } from "react";
import type { SelectHTMLAttributes } from "react";
import { FieldContext } from "./fieldContext";
import { fieldClasses, type FieldSize } from "./fieldStyles";

type SelectOwnProps = {
  size?: FieldSize;
  /** Marks the field as failing validation. Inherited from `Field` when wrapped. */
  invalid?: boolean;
};

export type SelectProps = SelectOwnProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">;

/**
 * A native `<select>` wearing the same height, radius, border and focus ring as
 * `Input`, so a form mixing the two does not look assembled from two kits.
 *
 * Deliberately native: the OS renders the open list, which means it is
 * scrollable, searchable by typing and correct on touch for free. This is the
 * dropdown for forms and editors.
 *
 * Filter and sort dropdowns in toolbars and filter bars use `FilterSelect`
 * instead, so every filter row opens the same app-styled list. It rebuilds the
 * popup in React and pays for that in code and in accessibility work, which is
 * why it is not the default for forms.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    size = "md",
    invalid,
    className = "",
    id,
    disabled,
    "aria-describedby": ariaDescribedBy,
    "aria-required": ariaRequired,
    children,
    ...rest
  },
  ref,
) {
  const field = useContext(FieldContext);
  const isInvalid = invalid ?? field?.invalid ?? false;
  // An explicit `aria-required` or HTML `required` on the control wins; only
  // when neither is given does the enclosing `Field` supply it. Emitted only
  // when true, so a plain select does not grow a stray `aria-required="false"`.
  const isRequired = ariaRequired ?? rest.required ?? field?.required;

  return (
    <select
      ref={ref}
      id={id ?? field?.controlId}
      disabled={disabled ?? field?.disabled ?? false}
      aria-invalid={isInvalid || undefined}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      aria-required={isRequired || undefined}
      className={fieldClasses({
        size,
        invalid: isInvalid,
        hasLeadingIcon: false,
        hasTrailing: false,
        className,
      })}
      {...rest}
    >
      {children}
    </select>
  );
});
