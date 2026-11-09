import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useDragControls } from "framer-motion";
import { ChevronsDownUp, ChevronsUpDown, GripVertical, X } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Collapsible } from "../../../components/ui/Collapsible";
import { Input } from "../../../components/ui/Input";
import { centralSpringToken } from "../../../styles/tokens";
import { AREA_ACCENTS, areaAccent, type AreaAccent } from "../layout/areaAccents";
import type { BoardGroup } from "../layout/boardGroups";
import { STAGE_LABELS, type BoardStage } from "../layout/boardStructure";
import { INTERACTIVE_WITHIN_CARD } from "./interactiveSelectors";

type BoardGroupSectionProps = {
  group: BoardGroup;
  canMove: boolean;
  onMoveStep: (direction: "up" | "down") => void;
  onDragMove: (element: HTMLElement) => void;
  onRename?: (groupId: string, name: string) => void;
  onToggle?: (groupId: string) => void;
  onDissolve?: (groupId: string) => void;
  /** Paints the area. Absent on a board that cannot be changed. */
  onRecolour?: (groupId: string, accent: AreaAccent) => void;
  /** The earliest stage among the area's cards, shown as the area's own. */
  stage?: BoardStage;
  registerElement: (groupId: string, element: HTMLElement | null) => void;
  children: ReactNode;
};

/**
 * The area's name while it is being edited.
 *
 * A draft rather than writing every keystroke through: the areas are persisted on every change, and
 * renaming an area character by character would be a storage write per key.
 */
function useAreaName(group: BoardGroup, onRename: BoardGroupSectionProps["onRename"]) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;

  const close = () => setDraft(null);

  function commit() {
    const next = (draft ?? "").trim();
    // An area with no name is an area nobody can talk about, so an emptied field keeps the old one.
    if (next && next !== group.name) onRename?.(group.id, next);
    close();
  }

  return { draft, editing, setDraft, commit, cancel: close };
}

type AreaName = ReturnType<typeof useAreaName>;

function AreaNameField({ group, name }: { group: BoardGroup; name: AreaName }) {
  const input = useRef<HTMLInputElement>(null);

  // Focused from an effect rather than through `autoFocus`, which `jsx-a11y` rejects — rightly, for
  // the case it is usually reached for, a field grabbing focus on page load. This is the other
  // case: the field appeared because the hire just made this area, and their next act is naming it.
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  return (
    <Input
      size="sm"
      ref={input}
      value={name.draft ?? ""}
      // Selected on focus so a freshly created area's placeholder name is replaced by
      // typing rather than edited around.
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => name.setDraft(event.target.value)}
      onBlur={name.commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          name.commit();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          name.cancel();
        }
      }}
      aria-label={`Name of the ${group.name} area`}
      className="max-w-56"
    />
  );
}

type AreaTitleProps = {
  group: BoardGroup;
  titleClass: string;
  name: AreaName;
  canRename: boolean;
};

/**
 * The name is the control. Naming an area you have just made should not mean leaving what you are
 * doing to find an unlabelled button, and a heading you can click is where everybody already tries
 * first — so renaming works in any mode, not only while arranging.
 */
function AreaTitle({ group, titleClass, name, canRename }: AreaTitleProps) {
  if (name.editing && canRename) return <AreaNameField group={group} name={name} />;

  return (
    <h2 className={`min-w-0 truncate text-sm font-semibold ${titleClass}`}>
      {canRename ? (
        <button
          type="button"
          onClick={() => name.setDraft(group.name)}
          title="Rename this area"
          className="max-w-full truncate rounded-sm hover:underline"
        >
          {group.name}
        </button>
      ) : (
        group.name
      )}
    </h2>
  );
}

type AreaGripProps = {
  group: BoardGroup;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onMoveStep: (direction: "up" | "down") => void;
};

function AreaGrip({ group, onPointerDown, onMoveStep }: AreaGripProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      title="Drag to move this area, or use the arrow keys"
      aria-label={`Move the ${group.name} area — drag, or use the arrow keys`}
      className="-ml-1 cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
        const on = event.key === "ArrowDown" || event.key === "ArrowRight";
        if (!back && !on) return;
        event.preventDefault();
        onMoveStep(back ? "up" : "down");
      }}
    >
      <GripVertical className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

type AreaPaletteProps = {
  group: BoardGroup;
  onRecolour: (groupId: string, accent: AreaAccent) => void;
};

/**
 * Four dots, revealed on approach like the controls on a card. Always-on swatches would put a paint
 * set in the header of every area on the board, which is a lot of colour for a decision most people
 * make once and never revisit.
 */
function AreaPalette({ group, onRecolour }: AreaPaletteProps) {
  return (
    <span className="mr-1 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-focus-within/area:opacity-100 group-hover/area:opacity-100 [[data-arranging]_&]:opacity-100">
      {AREA_ACCENTS.map((option) => {
        const chosen = (group.accent ?? "blue") === option;
        const label = `Paint the ${group.name} area ${areaAccent(option).label.toLowerCase()}`;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onRecolour(group.id, option)}
            aria-pressed={chosen}
            title={label}
            aria-label={label}
            className="group/accent flex h-6 w-6 items-center justify-center rounded-full"
          >
            <span
              aria-hidden="true"
              className={`h-3.5 w-3.5 rounded-full transition-transform ${
                areaAccent(option).swatch
              } ${
                chosen
                  ? "ring-2 ring-app-text/40 ring-offset-1 ring-offset-app-surface"
                  : "group-hover/accent:scale-125"
              }`}
            />
          </button>
        );
      })}
    </span>
  );
}

type AreaActionsProps = {
  group: BoardGroup;
  onDissolve?: (groupId: string) => void;
  onToggle?: (groupId: string) => void;
};

function AreaActions({ group, onDissolve, onToggle }: AreaActionsProps) {
  return (
    <>
      {onDissolve && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => onDissolve(group.id)}
          title="Take this area away — the cards stay on the board"
          aria-label={`Take the ${group.name} area away`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}

      {onToggle && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={() => onToggle(group.id)}
          aria-expanded={!group.collapsed}
          aria-label={
            group.collapsed ? `Unfold the ${group.name} area` : `Fold the ${group.name} area`
          }
        >
          {group.collapsed ? (
            <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronsDownUp className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      )}
    </>
  );
}

type AreaHeaderProps = Omit<
  BoardGroupSectionProps,
  "onDragMove" | "registerElement" | "children"
> & {
  titleClass: string;
  onGripPointerDown: AreaGripProps["onPointerDown"];
};

function AreaHeader(props: AreaHeaderProps) {
  const { group, canMove, onMoveStep, onRename, onToggle, onDissolve, onRecolour, stage } = props;
  const name = useAreaName(group, onRename);

  return (
    <header
      className="mb-3 flex items-center justify-between gap-2"
      // The same gesture the cards answer to: double-click the bar and the area folds or opens.
      // Anything in the header that already does something on a click — the name, the grip, the
      // stage, the fold and dissolve buttons — keeps doing exactly that.
      onDoubleClick={(event) => {
        if (!onToggle) return;
        if ((event.target as HTMLElement).closest(INTERACTIVE_WITHIN_CARD)) return;

        window.getSelection()?.removeAllRanges();
        onToggle(group.id);
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {canMove && (
          <AreaGrip group={group} onPointerDown={props.onGripPointerDown} onMoveStep={onMoveStep} />
        )}

        <AreaTitle
          group={group}
          titleClass={props.titleClass}
          name={name}
          canRename={onRename !== undefined}
        />

        <span className="shrink-0 text-xs text-app-text-subtle tabular-nums">
          {group.cardIds.length}
        </span>

        {/* Said only of an area whose cards are all from finished phases: "Now" on every other
            area would be the board labelling itself. The stage comes from the path, so it is a
            fact here and never a control. */}
        {stage === "BEHIND" && (
          <Badge variant="neutral" size="sm">
            {STAGE_LABELS[stage].title}
          </Badge>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {onRecolour && <AreaPalette group={group} onRecolour={onRecolour} />}
        <AreaActions group={group} onDissolve={onDissolve} onToggle={onToggle} />
      </div>
    </header>
  );
}

/**
 * One named area: its header, and the cards packed inside it.
 *
 * A component of its own for the same reason a card cell is — the drag controls are a hook, and an
 * area needs its own.
 *
 * An area has no position of its own; it sits where its earliest card sits. Moving it therefore
 * moves every card in it at once, which is why the grip belongs to the header rather than to any
 * of the cards inside. Dragging works exactly as it does for a card: the area lands on whatever
 * block its middle is over. The arrow keys do the same in one step, so an area is movable without
 * a pointer.
 */
export function BoardGroupSection({
  onDragMove,
  registerElement,
  children,
  ...header
}: BoardGroupSectionProps) {
  const { group, canMove } = header;
  const accent = areaAccent(group.accent);
  const dragControls = useDragControls();
  const element = useRef<HTMLElement | null>(null);

  return (
    <motion.section
      ref={(node) => {
        element.current = node;
        registerElement(group.id, node);
      }}
      layout="position"
      transition={centralSpringToken}
      drag={canMove}
      dragListener={false}
      dragControls={dragControls}
      dragSnapToOrigin
      dragElastic={0}
      dragMomentum={false}
      onDrag={() => element.current && onDragMove(element.current)}
      aria-label={group.name}
      // Tinted rather than outlined: an area is a tray the cards sit *in*, and a dashed rectangle
      // around white cards on a white page reads as a gap, not as a container. The tint is kept low
      // so a board of several areas is still a board and not a set of banners — which is also why
      // the hire picks from four quiet colours rather than from a colour wheel.
      className={`group/area rounded-2xl border p-3 shadow-sm ${accent.box}`}
    >
      <AreaHeader
        {...header}
        titleClass={accent.title}
        onGripPointerDown={(event) => dragControls.start(event)}
      />

      <Collapsible open={!group.collapsed}>{children}</Collapsible>
    </motion.section>
  );
}
