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
 * scrollable, searchable by typing and correct on touch for free. Reach for
 * `FilterSelect` instead only when the closed control has to carry custom
 * styling that a native select cannot express — it rebuilds the popup in React
 * and pays for that in code and in accessibility work.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    size = "md",
    invalid,
    className = "",
    id,
    disabled,
    "aria-describedby": ariaDescribedBy,
    children,
    ...rest
  },
  ref,
) {
  const field = useContext(FieldContext);
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <select
      ref={ref}
      id={id ?? field?.controlId}
      disabled={disabled ?? field?.disabled ?? false}
      aria-invalid={isInvalid || undefined}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
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
