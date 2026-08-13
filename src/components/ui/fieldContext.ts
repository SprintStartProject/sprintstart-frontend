import { createContext } from "react";

export type FieldContextValue = {
  /** `id` the control must carry so the `<label htmlFor>` points at it. */
  controlId: string;
  /**
   * Space-separated ids of the hint and error text, or `undefined` when the
   * field has neither. Goes straight into the control's `aria-describedby`.
   */
  describedBy: string | undefined;
  /** Whether the field is currently showing an error. */
  invalid: boolean;
  /** Mirrors `Field`'s `disabled`, so the control does not need it passed twice. */
  disabled: boolean;
};

/**
 * Carries the wiring between a `Field` and the control inside it: which `id`
 * the control must adopt, which elements describe it, and whether it is in an
 * error state.
 *
 * This exists because that wiring is exactly what hand-written forms forget.
 * A label without `htmlFor`, an error message that no screen reader ever
 * announces, an `aria-invalid` that nobody set — all three were present in the
 * codebase before, in different files. Putting the ids in context means the
 * caller writes `<Field label="Name"><Input /></Field>` and cannot get it wrong.
 *
 * `null` means "no `Field` wrapper", in which case the control falls back to
 * its own props and behaves like a plain input.
 *
 * Lives in its own module because a context may not be exported from a file
 * that also exports components (`react-refresh/only-export-components`).
 */
export const FieldContext = createContext<FieldContextValue | null>(null);
