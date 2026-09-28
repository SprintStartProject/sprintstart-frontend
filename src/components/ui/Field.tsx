import { useId, useMemo } from "react";
import type { ReactNode } from "react";
import { FieldContext, type FieldContextValue } from "./fieldContext";

export type FieldProps = {
  /** Visible label. Rendered as a real `<label>` bound to the control. */
  label?: ReactNode;
  /**
   * Explanatory text under the control ("Use a classic PAT, ghp_…"). Announced
   * to screen readers via `aria-describedby`, so it must not repeat the label.
   */
  hint?: ReactNode;
  /**
   * Validation message. Its presence *is* the error state: it colors the
   * control's border, sets `aria-invalid`, and is announced. Pass `undefined`
   * or an empty string when the field is fine.
   */
  error?: ReactNode;
  /**
   * Appends the conventional asterisk and carries the semantics through
   * context, so the wrapped control also gets `aria-required` — the asterisk
   * itself is `aria-hidden` and invisible to a screen reader.
   *
   * Presentation and ARIA, not constraint validation: this does **not** put the
   * native `required` attribute on the wrapped control, so no `:required`
   * styling and no browser "fill out this field" popup appear. The forms in
   * this app validate themselves — guarded submit buttons, inline errors — and
   * a label-level flag should not switch browser validation on behind their
   * backs. Pass `required` to the control itself when the native attribute is
   * wanted; the two stay separate on purpose.
   */
  required?: boolean;
  /**
   * Appends a visible "(optional)" to the label, the counterpart for fields the
   * form genuinely does not need. Rendered inside the `<label>` so it lands in
   * the control's accessible name and announces with the field; ignored when
   * `required` is also set, since the two are mutually exclusive in practice.
   */
  optional?: boolean;
  /**
   * Fixed id for the control, when something outside the field has to point at
   * it (`aria-controls`, a `ref`-free `focus()` by id, an existing E2E
   * selector). Leave it out and an id is generated — passing the id to the
   * control instead would silently break the label, since the `<label>` here
   * would still point at the generated one.
   */
  controlId?: string;
  /** Disables the control inside, without the caller passing it twice. */
  disabled?: boolean;
  /** Layout hook for the wrapper — spacing, width, grid placement. */
  className?: string;
  children: ReactNode;
};

/**
 * Label, control, hint and error as one unit, with the accessibility wiring
 * done rather than left to the caller.
 *
 * `Field` generates the ids, points the `<label>` at the control, collects hint
 * and error into `aria-describedby`, and flips `aria-invalid` — all through
 * context, so the control inside just works:
 *
 * ```tsx
 * <Field label="Token name" hint="Shown in the token list." error={nameError}>
 *     <Input value={name} onChange={(e) => setName(e.target.value)} />
 * </Field>
 * ```
 *
 * This is the part that was missing before: the codebase had 65 `htmlFor`
 * attributes but only 3 files using `aria-describedby`, so most error messages
 * sat next to their field visually and were invisible to a screen reader.
 *
 * The error is announced with `role="alert"`, which means it interrupts — right
 * for a message that appears in response to a submit, and the reason hints and
 * errors are separate props rather than one "message" slot.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  optional = false,
  controlId: providedControlId,
  disabled = false,
  className = "",
  children,
}: FieldProps) {
  const baseId = useId();
  const controlId = providedControlId ?? `${baseId}-control`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;

  const hasError = Boolean(error);
  const hasHint = Boolean(hint);

  const contextValue = useMemo<FieldContextValue>(() => {
    const described = [hasHint ? hintId : null, hasError ? errorId : null]
      .filter(Boolean)
      .join(" ");

    return {
      controlId,
      describedBy: described || undefined,
      invalid: hasError,
      disabled,
      required,
    };
  }, [controlId, hintId, errorId, hasHint, hasError, disabled, required]);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      {label && (
        <label htmlFor={controlId} className="text-sm font-medium text-app-text">
          {label}
          {required && (
            <span className="ml-0.5 text-app-danger-text" aria-hidden="true">
              *
            </span>
          )}
          {optional && !required && (
            <>
              {" "}
              <span className="ml-1 text-xs font-normal text-app-text-subtle">(optional)</span>
            </>
          )}
        </label>
      )}

      <FieldContext.Provider value={contextValue}>{children}</FieldContext.Provider>

      {hasHint && (
        <p id={hintId} className="text-xs text-app-text-muted">
          {hint}
        </p>
      )}

      {hasError && (
        <p id={errorId} role="alert" className="text-xs font-medium text-app-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
