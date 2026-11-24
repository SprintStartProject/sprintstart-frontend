import type { RiskLevel } from "../../services/offboardingTypes";

/** How a departure leaves a file, in words, and the status colour that goes with it. */
export const LEVELS: Record<RiskLevel, { label: string; variant: "danger" | "warning" }> = {
  ORPHANED: { label: "Nobody left", variant: "danger" },
  HOARDED: { label: "One person left", variant: "warning" },
};
