import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, Inbox, PenLine, Plus } from "lucide-react";

type StarterWorkAddMenuProps = {
  /** HR reads the pool and can browse issues, but does not hand-author work. */
  canAct: boolean;
  onPickFromIssues: () => void;
  onWriteOne: () => void;
};

type MenuPosition = { top: number; left: number };

const MENU_WIDTH = 300;
const VIEWPORT_PADDING = 8;
const MENU_GAP = 8;

function getMenuPosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, rect.right - MENU_WIDTH),
    window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING,
  );
  return { top: rect.bottom + MENU_GAP, left };
}

/**
 * The two ways to add a task by hand, collapsed into one header menu next to the standalone
 * "Find with AI" button. "Pick from issues" opens the corpus browser in its own sheet rather than
 * sharing a tab with the pool.
 */
export function StarterWorkAddMenu({
  canAct,
  onPickFromIssues,
  onWriteOne,
}: StarterWorkAddMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const open = () => {
    if (triggerRef.current) setPosition(getMenuPosition(triggerRef.current));
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  // Pointerdown (not click) so the menu is gone before a click on whatever sits underneath lands,
  // and it is checked against both the trigger and the portaled menu, which `containerRef` alone
  // would miss.
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        close();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const pick = (action: () => void) => {
    close();
    action();
  };

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        data-testid="add-tasks-menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close() : open())}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-app-brand px-5 text-sm font-medium text-white shadow-app-brand-lift transition-colors hover:bg-app-brand-hover"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add tasks
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && position && (
            <motion.div
              ref={menuRef}
              role="menu"
              aria-label="Add tasks"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: MENU_WIDTH,
                zIndex: 100,
              }}
              className="rounded-2xl border border-app-border bg-app-surface p-1.5 shadow-2xl"
            >
              <MenuItem
                icon={Inbox}
                title="Pick from issues"
                description="Browse the project's open issues and add one yourself."
                testId="pick-from-issues"
                onClick={() => pick(onPickFromIssues)}
              />
              {canAct && (
                <MenuItem
                  icon={PenLine}
                  title="Write one"
                  description="A task the tracker doesn't have yet."
                  testId="add-starter-task"
                  onClick={() => pick(onWriteOne)}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  title,
  description,
  testId,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-app-surface-hover"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-brand-soft text-app-brand-text">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-app-text">{title}</span>
        <span className="block text-xs text-app-text-muted">{description}</span>
      </span>
    </button>
  );
}
