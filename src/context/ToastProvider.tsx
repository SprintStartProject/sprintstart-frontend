import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastContext, type Toast, type ToastOptions, type ToastVariant } from "./ToastContext";
import { ToastViewport } from "../components/ui/Toast";

/**
 * How many toasts may be on screen at once. Beyond this the oldest is dropped
 * to make room, so a burst of failures can never bury the page in a wall of
 * cards — the user sees the most recent handful and no more.
 */
const MAX_TOASTS = 4;

/**
 * Per-variant auto-dismiss time, in milliseconds.
 *
 * The scale is deliberate: a success is a pat on the back and should get out of
 * the way quickly, while an error is something the user may need to read, copy,
 * or act on, so it lingers. A caller can always override via
 * {@link ToastOptions.duration}, including `Infinity` to pin the toast open.
 */
const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 4000,
  info: 5000,
  warning: 8000,
  error: 12000,
};

/**
 * Provides the app-wide toast stack and renders its viewport.
 *
 * State lives here; the actual cards are drawn by {@link ToastViewport}, which
 * this component mounts as a sibling of `children` (the viewport portals itself
 * to `document.body`, so its DOM position here does not matter). Mount this once
 * near the root — inside the theme provider so the cards pick up light/dark, and
 * high enough that any page can reach `useToast`.
 *
 * Auto-dismiss timing is not managed here: each card owns its own timer so it
 * can pause on hover without the provider having to track wall-clock time for
 * every toast. The provider only ever *adds* and *removes* entries.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Monotonic counter for ids — cheap, collision-free, and stable across the
  // rapid double-fires that a "click twice" or a retry loop can produce, where
  // a time-based id could repeat within the same millisecond.
  const nextId = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (variant: ToastVariant, message: string, options: ToastOptions = {}): string => {
      const id = `toast-${nextId.current++}`;
      const toast: Toast = {
        id,
        variant,
        message,
        duration: options.duration ?? DEFAULT_DURATIONS[variant],
        description: options.description,
        action: options.action,
      };
      setToasts((prev) => {
        const next = [...prev, toast];
        // Keep only the newest MAX_TOASTS; the overflow falls off the top.
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });
      return id;
    },
    [],
  );

  const info = useCallback(
    (message: string, options?: ToastOptions) => show("info", message, options),
    [show],
  );
  const success = useCallback(
    (message: string, options?: ToastOptions) => show("success", message, options),
    [show],
  );
  const warning = useCallback(
    (message: string, options?: ToastOptions) => show("warning", message, options),
    [show],
  );
  const error = useCallback(
    (message: string, options?: ToastOptions) => show("error", message, options),
    [show],
  );

  const dismissAll = useCallback(() => setToasts([]), []);

  const value = useMemo(
    () => ({ toasts, show, info, success, warning, error, dismiss, dismissAll }),
    [toasts, show, info, success, warning, error, dismiss, dismissAll],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
