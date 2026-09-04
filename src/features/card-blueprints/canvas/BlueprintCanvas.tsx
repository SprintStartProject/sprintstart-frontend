import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type IsValidConnection,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LayoutGrid } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { STAGE_LABELS, type BoardStage } from "../../board/layout/boardStructure";
import type { ProjectRole } from "../../team-management/types";
import type { CardBlueprint } from "../types";
import { BlueprintNode, type BlueprintFlowNode } from "./BlueprintNode";
import { BlueprintPalette, PALETTE_MIME, type PaletteDrag } from "./BlueprintPalette";
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  buildLanes,
  stageForAbsoluteY,
  toAbsolute,
  toRelative,
  withFallbackPositions,
  wouldCycle,
  type CanvasPosition,
  type CanvasPositions,
} from "./canvasLayout";

export type BlueprintCanvasProps = {
  /** The blueprints to draw — already narrowed by the page's role selector. */
  blueprints: CardBlueprint[];
  /**
   * Every blueprint on the project, filtered or not.
   *
   * Two things need the unfiltered set: naming the card a drawn card waits on when that one is
   * filtered out, and refusing a chain that would close a loop through a card nobody can see.
   */
  allBlueprints: CardBlueprint[];
  roles: ProjectRole[];
  positions: CanvasPositions;
  /** A card was dropped: where it now sits in its band, and which band that is. */
  onPlace: (id: string, position: CanvasPosition, stage: BoardStage) => void;
  /** An edge was drawn or cut: what this card now comes after, or null. */
  onChain: (id: string, afterId: string | null) => void;
  /** A palette tile was dropped on empty canvas. */
  onCreateAt: (position: CanvasPosition, stage: BoardStage, roleIds: string[]) => void;
  onEdit: (blueprint: CardBlueprint) => void;
  onRemove: (blueprint: CardBlueprint) => void;
  onAutoLayout: () => void;
};

const nodeTypes: NodeTypes = { blueprint: BlueprintNode };

/**
 * The blueprints as a flow: cards where the PM put them, chains as edges they can draw by hand.
 *
 * The list beside this is a good way to *store* blueprints and a poor way to think about a process.
 * "Read the runbook, then get deploy access, then ship something small" is three rows and two
 * dropdown selections in a list; here it is three boxes and two arrows, and a fourth card that
 * nobody sequenced is visibly floating rather than hiding at row nine.
 *
 * **The vertical axis is the stage and nothing else.** Two bands, one per stage, and the band a
 * card is dropped in is the stage it is saved with — the drag *is* the edit. Horizontal position is
 * the PM's own arrangement and means nothing to anyone else, which is why it is stored per project
 * and never read by the generator.
 *
 * Nodes are never deletable by keypress even though edges are. Backspace on a selected edge undoes
 * a dependency, which is a decision one drag can restore; Backspace on a selected card would delete
 * a blueprint every hire's board is seeded from, and the toolbar's button — which asks nothing but
 * at least has to be aimed at — is already more confirmation than the keyboard would give.
 */
export function BlueprintCanvas(props: BlueprintCanvasProps) {
  return (
    <ReactFlowProvider>
      <BlueprintCanvasSurface {...props} />
    </ReactFlowProvider>
  );
}

function BlueprintCanvasSurface({
  blueprints,
  allBlueprints,
  roles,
  positions,
  onPlace,
  onChain,
  onCreateAt,
  onEdit,
  onRemove,
  onAutoLayout,
}: BlueprintCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();

  /** The band a palette drag is currently over, so the drop target is visible before the drop. */
  const [dropStage, setDropStage] = useState<BoardStage | null>(null);

  const placed = useMemo(
    () => withFallbackPositions(blueprints, positions),
    [blueprints, positions],
  );

  const lanes = useMemo(
    () =>
      buildLanes(
        blueprints.map((blueprint) => ({
          stage: blueprint.stage,
          position: placed[blueprint.id],
        })),
      ),
    [blueprints, placed],
  );

  const roleName = useCallback(
    (id: string) => roles.find((role) => role.id === id)?.name ?? "Unknown role",
    [roles],
  );

  const computedNodes = useMemo<BlueprintFlowNode[]>(() => {
    const drawn = new Set(blueprints.map((blueprint) => blueprint.id));

    return blueprints.map((blueprint) => {
      // Named on the card only when no edge can say it: an arrow between two drawn cards already
      // does, and repeating it in text would be the same fact twice.
      const hiddenPredecessor =
        blueprint.afterId && !drawn.has(blueprint.afterId)
          ? (allBlueprints.find((other) => other.id === blueprint.afterId)?.title ??
            "a removed blueprint")
          : null;

      const roleNames = blueprint.roleIds.map(roleName);

      return {
        id: blueprint.id,
        type: "blueprint" as const,
        position: toAbsolute(placed[blueprint.id], blueprint.stage, lanes),
        deletable: false,
        data: { blueprint, roleNames, waitsOnTitle: hiddenPredecessor, onEdit, onRemove },
        ariaLabel: [
          blueprint.title,
          STAGE_LABELS[blueprint.stage].title,
          roleNames.length === 0 ? "everybody" : roleNames.join(", "),
          hiddenPredecessor ? `waits for ${hiddenPredecessor}` : null,
        ]
          .filter(Boolean)
          .join(", "),
      };
    });
  }, [blueprints, allBlueprints, placed, lanes, roleName, onEdit, onRemove]);

  // React Flow moves a node during a drag only when it owns the node list, so the derived nodes are
  // pushed into its state rather than passed straight through. The push after a drop is what snaps
  // a card into the band it was dropped in.
  const [nodes, setNodes, onNodesChange] = useNodesState<BlueprintFlowNode>(computedNodes);
  useEffect(() => setNodes(computedNodes), [computedNodes, setNodes]);

  const edges = useMemo<Edge[]>(() => {
    const byId = new Map(blueprints.map((blueprint) => [blueprint.id, blueprint]));

    return blueprints
      .filter((blueprint) => blueprint.afterId !== null && byId.has(blueprint.afterId))
      .map((blueprint) => {
        const after = byId.get(blueprint.afterId as string);
        const crossesBands = after !== undefined && after.stage !== blueprint.stage;

        return {
          id: `${blueprint.afterId}->${blueprint.id}`,
          source: blueprint.afterId as string,
          target: blueprint.id,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
          // A chain that crosses a band is not a pile on the hire's board — it is a card that waits
          // from a distance, and the dashed line is the board's own way of saying so.
          style: crossesBands ? { strokeDasharray: "6 4" } : undefined,
          ariaLabel: `${after?.title ?? ""} comes before ${blueprint.title}`,
        };
      });
  }, [blueprints]);

  /** Rejected while dragging rather than after dropping, so the handle simply refuses to take. */
  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      const { source, target } = connection;
      if (!source || !target || source === target) return false;

      return !wouldCycle(allBlueprints, target, source);
    },
    [allBlueprints],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (!isValidConnection(connection)) return;

      onChain(connection.target, connection.source);
    },
    [isValidConnection, onChain],
  );

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) onChain(edge.target, null);
    },
    [onChain],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes(PALETTE_MIME)) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";

      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setDropStage(stageForAbsoluteY(point.y - NODE_HEIGHT / 2, lanes));
    },
    [lanes, screenToFlowPosition],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const raw = event.dataTransfer.getData(PALETTE_MIME);
      setDropStage(null);
      if (!raw) return;

      event.preventDefault();

      let payload: PaletteDrag;
      try {
        payload = JSON.parse(raw) as PaletteDrag;
      } catch {
        return;
      }

      // The pointer holds the middle of the card, not its corner — a card that appeared below and
      // to the right of where it was dropped would be a card the canvas moved on its own.
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const absolute = { x: point.x - NODE_WIDTH / 2, y: point.y - NODE_HEIGHT / 2 };
      const stage = stageForAbsoluteY(absolute.y, lanes);

      onCreateAt(
        toRelative(absolute, stage, lanes),
        stage,
        Array.isArray(payload.roleIds)
          ? payload.roleIds.filter((id) => typeof id === "string")
          : [],
      );
    },
    [lanes, onCreateAt, screenToFlowPosition],
  );

  return (
    <div className="flex h-full w-full overflow-hidden rounded-2xl border border-app-border bg-app-surface">
      <BlueprintPalette roles={roles} />

      <div
        className="relative min-w-0 flex-1"
        role="application"
        aria-label="Card blueprint canvas"
        data-testid="blueprint-canvas"
        onDragOver={handleDragOver}
        onDragLeave={() => setDropStage(null)}
        onDrop={handleDrop}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={(_event, node) => {
            const stage = stageForAbsoluteY(node.position.y, lanes);
            onPlace(node.id, toRelative(node.position, stage, lanes), stage);
          }}
          onConnect={handleConnect}
          isValidConnection={isValidConnection}
          onEdgesDelete={handleEdgesDelete}
          deleteKeyCode={["Backspace", "Delete"]}
          connectionRadius={28}
          minZoom={0.2}
          fitView
          fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
          proOptions={{ hideAttribution: false }}
        >
          <ViewportPortal>
            {/* Behind the edges and the cards: the bands are the ground the canvas stands on, and
                they must never take a click meant for what is drawn on them. */}
            <div style={{ position: "absolute", left: 0, top: 0, zIndex: -1 }}>
              {lanes.map((lane) => {
                const count = blueprints.filter(
                  (blueprint) => blueprint.stage === lane.stage,
                ).length;

                return (
                  <div
                    key={lane.stage}
                    data-testid={`blueprint-lane-${lane.stage}`}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: lane.top,
                      width: lane.width,
                      height: lane.height,
                      pointerEvents: "none",
                    }}
                    className={[
                      "rounded-3xl border border-dashed transition-colors duration-200",
                      dropStage === lane.stage
                        ? "border-app-brand-border-strong bg-app-brand-soft"
                        : "border-app-border bg-app-surface-muted/40",
                    ].join(" ")}
                  >
                    <div className="flex items-baseline gap-2 px-6 pt-4">
                      <span className="text-sm font-semibold text-app-text">
                        {STAGE_LABELS[lane.stage].title}
                      </span>
                      <span className="text-xs text-app-text-muted tabular-nums">
                        {count} {count === 1 ? "card" : "cards"}
                      </span>
                      <span className="text-xs text-app-text-subtle">
                        {STAGE_LABELS[lane.stage].hint}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ViewportPortal>

          <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable ariaLabel="Canvas overview" />

          <Panel position="top-right">
            <Button
              variant="secondary"
              size="sm"
              onClick={onAutoLayout}
              icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
            >
              Tidy up
            </Button>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
