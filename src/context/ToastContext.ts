import { createContext } from "react";

/**
 * Semantic kind of a toast. Pick by *meaning*, never by colour:
 *
 * - `info` — neutral, ambient feedback the user did not have to ask for
 *   ("Copied to clipboard", "Sync running in the background").
 * - `success` — an action the user took completed as intended.
 * - `warning` — the action went through, but with a caveat worth reading
 *   ("Saved, but 2 rows were skipped").
 * - `error` — the action failed and the user's intent was not carried out.
 */
export type ToastVariant = "info" | "success" | "warning" | "error";

/**
 * An optional action rendered as a button inside the toast.
 *
 * The archetype is "Undo" on a destructive or easily-regretted action, which is
 * why {@link ToastProvider} pre-dismisses the toast as soon as the button is
 * pressed — the user has moved on, the message has served its purpose. A longer
 * default {@link ToastOptions.duration | duration} pairs well with this so the
 * window to undo is not gone in four seconds.
 */
export interface ToastAction {
  /** Button label, e.g. `"Undo"` / `"Rückgängig"`. */
  label: string;
  /** Invoked on click. The toast is dismissed immediately afterwards. */
  onClick: () => void;
}

/** Everything about a toast except its identity and its required message. */
export interface ToastOptions {
  /**
   * Secondary line under the message, for detail that would make the headline
   * too long (an error code, which rows were affected). Kept short — a toast is
   * a glance, not a dialog.
   */
  description?: string;
  /**
   * How long the toast stays up, in milliseconds, before it auto-dismisses.
   * `Infinity` (or `0`) pins it until the user closes it — reserve that for
   * things that must be acknowledged. When omitted, a per-variant default is
   * used (errors linger longest, successes shortest); see `DEFAULT_DURATIONS`
   * in the provider.
   */
  duration?: number;
  /** Optional action button, typically an "Undo". See {@link ToastAction}. */
  action?: ToastAction;
}

/** A live toast: the options plus the identity the provider assigns. */
export interface Toast extends ToastOptions {
  /** Stable key for React and for {@link ToastContextType.dismiss}. */
  id: string;
  variant: ToastVariant;
  /** The headline — the one line the user is guaranteed to read. */
  message: string;
}

/**
 * The toast API, obtained through the {@link useToast} hook.
 *
 * The four named helpers are the everyday surface — `toast.success("Saved")`.
 * `show` exists for the rare case where the variant is computed at runtime.
 * Every creator returns the new toast's id so a caller can later `dismiss` it
 * itself (e.g. clearing a "still loading…" toast once the request resolves).
 */
export interface ToastContextType {
  /** The currently visible toasts, oldest first. Consumed by the viewport. */
  toasts: Toast[];
  /** Low-level creator with an explicit variant. Returns the new toast's id. */
  show: (variant: ToastVariant, message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  /** Removes one toast by id (what the close button and undo call). */
  dismiss: (id: string) => void;
  /** Clears every toast at once, e.g. on route changes or logout. */
  dismissAll: () => void;
}

/**
 * Context for the app-wide toast stack. Access it through the {@link useToast}
 * hook rather than `useContext` directly, so components stay decoupled from the
 * context object and keep working when rendered without a provider (tests).
 */
export const ToastContext = createContext<ToastContextType | undefined>(undefined);
