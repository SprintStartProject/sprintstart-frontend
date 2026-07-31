import { useContext } from "react";
import { MomentsContext } from "./MomentsContext.ts";

/**
 * Hook to access the app's celebratory layer.
 *
 * @returns The moments context value.
 * @throws Error if used outside of a `MomentsProvider`.
 */
export function useMoments() {
    const context = useContext(MomentsContext);
    if (context === undefined) {
        throw new Error("useMoments must be used within a MomentsProvider");
    }
    return context;
}
