import { useContext } from "react";
import { ToastContext, type ToastContextType } from "./ToastContext";

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
  if (context === undefined) {
    return {
      toasts: [],
      show: () => "",
      info: () => "",
      success: () => "",
      warning: () => "",
      error: () => "",
      dismiss: () => {},
      dismissAll: () => {},
    };
  }
  return context;
}
