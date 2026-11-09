import { AnimatePresence } from "framer-motion";
import { BOARD_STAGES } from "../layout/boardStructure";
import { ROW_UNIT, type Block, type Item } from "../layout/gridBlocks";
import type { GridView } from "../hooks/useGridView";
import { BoardGroupSection } from "./BoardGroupSection";
import { BoardStageBand } from "./BoardStageBand";
import { ExpandedStack } from "./ExpandedStack";
import { GridBlock } from "./GridBlock";
import { GridCard } from "./GridCard";

type ViewProps = { view: GridView };

/** One thing inside a column or an area: a card, or a sequence somebody has spread out. */
function ItemView({ item, view }: ViewProps & { item: Item }) {
  if (item.kind === "card") return <GridCard card={item.card} view={view} />;

  const { onToggleStack } = view.props;

  return (
    <ExpandedStack
      stack={item.stack}
      onCollapse={onToggleStack ? () => onToggleStack(item.stack.rootId) : undefined}
    >
      {item.cards.map((card) => (
        <GridCard key={card.id} card={card} view={view} />
      ))}
    </ExpandedStack>
  );
}

/** An area's items, folded by stage — the same fold as the board's own, one level in. */
function BandedItems({ items, span, view }: ViewProps & { items: Item[]; span: number }) {
  const { states, openStages, onToggleStage } = view.props;

  return (
    <div className="space-y-3">
      {BOARD_STAGES.map((stage) => {
        const own = items.filter((item) => view.layout.stagesIn(item.cards)[0] === stage);
        if (own.length === 0) return null;

        const cards = own.flatMap((item) => item.cards);

        return (
          <BoardStageBand
            key={stage}
            stage={stage}
            total={cards.length}
            remaining={cards.filter((card) => states?.get(card.id)?.status !== "DONE").length}
            open={openStages?.has(stage) ?? true}
            onToggle={onToggleStage ? () => onToggleStage(stage) : undefined}
          >
            <BlockList blocks={own} columns={span} view={view} />
          </BoardStageBand>
        );
      })}
    </div>
  );
}

type BlockViewProps = ViewProps & { block: Block; blockIndex: number; span: number };

/**
 * One block: a card, or an area with its cards inside it.
 *
 * An area whose cards span several stages (see `spanningGroups`) is folded by stage inside
 * itself. Any other area lays its items out in a grid of its own, `span` columns wide, so cards
 * in an area can sit next to each other.
 */
function BlockView({ block, blockIndex, span, view }: BlockViewProps) {
  if (block.kind !== "group") return <ItemView item={block} view={view} />;

  const { props: grid, layout, blockMoves, drag } = view;
  // No stage badge on an area that spans stages: the whole point of it is that its cards do not
  // share one, and the bands inside say what each of them is.
  const spanning = layout.spanningGroups.includes(block);

  return (
    <BoardGroupSection
      group={block.group}
      canMove={grid.onReorder !== undefined}
      onMoveStep={(direction) => blockMoves.moveBlock(blockIndex, direction)}
      onDragMove={(element) => blockMoves.handleGroupDrag(blockIndex, element)}
      onRename={grid.onRenameGroup}
      onToggle={grid.onToggleGroup}
      onDissolve={grid.onDissolveGroup}
      onRecolour={grid.onRecolourGroup}
      stage={spanning ? undefined : grid.states?.get(block.cards[0]?.id ?? "")?.stage}
      registerElement={drag.registerGroupElement}
    >
      {spanning ? (
        <BandedItems items={block.items} span={span} view={view} />
      ) : (
        // The area's cards in the area's own grid. This is what "things inside an area can sit
        // next to each other" comes down to: an area two columns wide is two columns inside.
        <BlockList blocks={block.items} columns={span} view={view} />
      )}
    </BoardGroupSection>
  );
}

type BlockListProps = ViewProps & { blocks: Block[]; columns: number };

/**
 * A list of blocks as a grid: each one as wide as it asked for, each one as tall as it measures.
 *
 * This replaced a two-column packing that balanced blocks by an estimate of their height. The
 * packing was the reason a card could only ever be one column or the whole row, why an area laid
 * its cards out one under another, and why "taller" could do nothing but put a floor under a card
 * — none of which were decisions, they were what a flow of two columns can express.
 *
 * `columns` is passed rather than read from a breakpoint, because an area draws the same grid
 * inside itself at its own width: two columns wide means two columns inside, so a card in an area
 * is the same size as a narrow card outside one.
 */
function BlockList({ blocks, columns, view }: BlockListProps) {
  const { layout, gap, reduceMotion } = view;

  return (
    <div
      className="grid items-start"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoRows: `${ROW_UNIT}px`,
        gap,
      }}
    >
      {/* A block that leaves fades out instead of being cut. Opening a pile swaps one block for
          another in the same slot, and without this the card was gone and the frame simply *there*
          — the crossfade is what makes it read as the same thing changing shape. `initial={false}`
          so a board arriving does not fade every card in behind the page's own entrance.

          `popLayout` takes a leaving block out of the flow the frame it starts fading, so the grid
          closes over it instead of holding its cell for the length of an exit. */}
      <AnimatePresence initial={false} mode="popLayout">
        {blocks.map((block) => {
          const span = layout.spanOf(block, columns);

          return (
            <GridBlock key={block.key} span={span} gap={gap} reduceMotion={reduceMotion ?? false}>
              <BlockView
                block={block}
                blockIndex={layout.indexOfBlock(block)}
                span={span}
                view={view}
              />
            </GridBlock>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/**
 * Only while arranging: an empty area is a destination, and a row of empty boxes over a board
 * somebody is only reading would be the page advertising work to do.
 */
function EmptyAreasTray({ view }: ViewProps) {
  const { emptyGroups } = view.layout;
  const register = view.drag.registerGroupElement;

  return (
    <section className="space-y-2" aria-label="Areas with nothing in them">
      <p className="px-1 text-xs text-app-text-muted">Drop a card into one of these to file it.</p>

      <div className="flex flex-wrap gap-3">
        {emptyGroups.map((group) => (
          <div
            key={group.id}
            ref={(element) => {
              register(group.id, element);
            }}
            className="flex min-h-20 min-w-48 flex-1 flex-col justify-center rounded-2xl border border-dashed border-app-border bg-app-surface-muted/40 px-4 py-3"
          >
            <p className="truncate text-sm font-medium text-app-text" title={group.name}>
              {group.name}
            </p>
            <p className="text-xs text-app-text-subtle">Empty</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The board's bands, or its blocks as one flat grid when there are no bands to draw. */
function BandedBlocks({ view }: ViewProps) {
  const { layout, columns, props: grid } = view;
  const { openStages, onToggleStage } = grid;

  if (layout.bands.length === 0) {
    const rest = layout.blocks.filter((block) => !layout.spanningGroups.includes(block));

    return <BlockList blocks={rest} columns={columns} view={view} />;
  }

  return (
    <>
      {layout.bands.map((band) => (
        <BoardStageBand
          key={band.stage}
          stage={band.stage}
          total={band.total}
          remaining={band.remaining}
          open={openStages?.has(band.stage) ?? true}
          onToggle={onToggleStage ? () => onToggleStage(band.stage) : undefined}
        >
          <BlockList blocks={band.blocks} columns={columns} view={view} />
        </BoardStageBand>
      ))}
    </>
  );
}

export function BoardLayout({ view }: ViewProps) {
  const { layout, columns, props: grid } = view;

  return (
    // `space-y-12` between the bands, against `space-y-4` between the cards inside one. A heading
    // is only a heading if the gap above it is clearly wider than the gaps it presides over — at
    // the same 24px as everything else, "Later" read as one more thing in the list above rather
    // than as the start of the next one. It is also the room a fanned pile in the last row needs,
    // so the sheets of a card at the bottom of "Now" do not reach into the heading under it.
    <div className="space-y-12" data-arranging={grid.isArranging || undefined}>
      {grid.isArranging && layout.emptyGroups.length > 0 && grid.onAssignGroup && (
        <EmptyAreasTray view={view} />
      )}

      {layout.spanningGroups.map((block) => (
        <div key={block.key}>
          <BlockView
            block={block}
            blockIndex={layout.indexOfBlock(block)}
            span={columns}
            view={view}
          />
        </div>
      ))}

      <BandedBlocks view={view} />
    </div>
  );
}
