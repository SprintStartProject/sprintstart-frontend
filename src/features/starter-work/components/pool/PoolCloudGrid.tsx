import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { centralSpringToken } from "../../../../styles/tokens";
import type { StarterWorkTask } from "../../../../services/starterWorkTypes";
import type { CloudSlotStyle } from "./cloudLayout";
import { PoolCloudCard } from "./PoolCloudCard";

type PoolCloudGridProps = {
  items: StarterWorkTask[];
  layout: CloudSlotStyle[];
  closed: boolean;
  onOpen: (task: StarterWorkTask) => void;
};

/**
 * A real 4-column CSS grid, not absolute-positioned percentages: `items-start` keeps every row on one
 * horizontal line, while each card is held to 70% of its cell's width and pulled right by the
 * percentage from `layout` (one of five seeded arrangements; see `buildCloudLayouts`). That left
 * offset is the only thing that varies from card to card, so the cloud reads as scattered without any
 * card drifting or tilting out of place.
 */
export function PoolCloudGrid({ items, layout, closed, onOpen }: PoolCloudGridProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div data-pool-flight-target className="relative overflow-hidden rounded-2xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-4 opacity-40"
        style={{
          backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "linear-gradient(to bottom, black, transparent 92%)",
        }}
      />
      {/* A very soft brand shimmer behind the dot grid, centred rather than mouse-tracked like a
          card's own spotlight — this one just says "something lives here". */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: "radial-gradient(ellipse at center, var(--brand-glow), transparent 65%)",
        }}
      />

      <div
        className="relative z-10 grid grid-cols-4 items-start gap-4 p-4"
        data-testid="pool-task-cloud"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((task, index) => (
            <motion.div
              key={task.id}
              layout={!prefersReducedMotion}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              transition={{ ...centralSpringToken, delay: index * 0.04 }}
              whileHover={prefersReducedMotion ? undefined : { y: -4 }}
              data-testid={`pool-task-${task.id}`}
              className="w-[70%]"
              style={{ marginLeft: `${(layout[index] ?? layout[0]).offsetPercent}%` }}
            >
              <PoolCloudCard task={task} onOpen={onOpen} closed={closed} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
