import { CheckCircle2, CircleDashed, Hourglass, XCircle, type LucideIcon } from "lucide-react";
import type { BadgeVariant } from "../../components/ui/Badge";
import type { ArtifactAiStatus } from "./types";

/** How one AI status is drawn: text, icon and colour together, never colour alone. */
export interface AiStatusChipSpec {
  /** Visible chip text. */
  label: string;
  /** Spoken form, appended to the card's accessible name. */
  spoken: string;
  /**
   * Tooltip. Says what the chip reports — the AI assistant's index record — and nothing more:
   * a failed vector removal can leave the record at "indexed" for a while, so the chip must
   * not promise the assistant can find the content.
   */
  meaning: string;
  variant: BadgeVariant;
  icon: LucideIcon;
}

const NOT_INDEXED: AiStatusChipSpec = {
  label: "Not indexed",
  spoken: "not indexed for the AI assistant",
  meaning: "The AI assistant's index holds no record of this artifact.",
  variant: "neutral",
  icon: CircleDashed,
};

/** Chip per status, per kb-contract part 3. DEINDEXED and UNKNOWN read the same to a reader. */
export const AI_STATUS_CHIPS: Readonly<Record<ArtifactAiStatus, AiStatusChipSpec>> = {
  INDEXED: {
    label: "Indexed",
    spoken: "indexed for the AI assistant",
    meaning: "The AI assistant's index records this artifact as indexed.",
    variant: "success",
    icon: CheckCircle2,
  },
  PROCESSING: {
    label: "Indexing",
    spoken: "being indexed for the AI assistant",
    meaning: "The AI assistant's index records this artifact as being processed.",
    variant: "brand",
    icon: Hourglass,
  },
  FAILED: {
    label: "Failed",
    spoken: "indexing for the AI assistant failed",
    meaning: "The AI assistant's index records that indexing this artifact failed.",
    variant: "danger",
    icon: XCircle,
  },
  DEINDEXED: NOT_INDEXED,
  UNKNOWN: NOT_INDEXED,
};
