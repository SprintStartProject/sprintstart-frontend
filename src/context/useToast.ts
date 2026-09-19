import { useContext } from "react";
import {
  ToastApiContext,
  ToastContext,
  type ToastApi,
  type ToastContextType,
} from "./ToastContext";

/**
 * The no-provider fallback, shared by both hooks. Module-level so it is one
 * stable object: a fresh one per render would defeat the point of
 * `useToastApi` (its value must not change identity) and would churn any
 * effect that depends on it.
 */
const INERT_API: ToastApi = {
  show: () => "",
  info: () => "",
  success: () => "",
  warning: () => "",
  error: () => "",
  dismiss: () => {},
  dismissAll: () => {},
};

const INERT_CONTEXT: ToastContextType = { toasts: [], ...INERT_API };

/**
 * The toast API without the visible list — the same functions `useToast`
 * returns, from a context whose value never changes identity.
 *
 * Use this when a component only *raises* toasts: consuming `useToast` instead
 * subscribes to the list as well, so every toast appearing anywhere in the app
 * (and every auto-dismiss) re-renders that component. Outside a
 * {@link ToastProvider} it returns the same inert no-ops as `useToast`.
 */
export function useToastApi(): ToastApi {
  const context = useContext(ToastApiContext);
  if (context === undefined) return INERT_API;
  return context;
}

/**
 * Access to the app-wide toast stack.
 *
 * ```tsx
 * const toast = useToast();
 * toast.success("Project saved");
 * toast.error("Could not reach the server", { description: "HTTP 503" });
 * toast.info("Row deleted", { action: { label: "Undo", onClick: restore } });
 * ```
 *
 * Outside a {@link ToastProvider} the hook returns inert no-ops (and an empty
 * list) rather than throwing, so a component can be unit-tested or previewed in
 * isolation without wiring up the provider. In the running app the provider is
 * mounted once near the root, so real toasts always appear.
 */
export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (context === undefined) return INERT_CONTEXT;
  return context;
}
