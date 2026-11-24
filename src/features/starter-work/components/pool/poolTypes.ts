import type { StarterWorkTask } from "../../../../services/starterWorkTypes";

export type PoolView = "cloud" | "list";

export type PoolTaskProps = {
  task: StarterWorkTask;
  onOpen: (task: StarterWorkTask) => void;
  /**
   * True inside the "Closed" filter: dims the row/card and swaps the unseen/seen marker and the
   * summary line for an archive icon and a "Closed …" timestamp, since neither of those mean
   * anything for a task that already left the live pool.
   */
  closed?: boolean;
};
