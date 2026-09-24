import { useReducedMotion } from "framer-motion";
import { useId } from "react";
import { AREA_META } from "./analysisMeta";
import type { AnalysisTask } from "./useProjectAnalysis";

const W = 640;
const H = 460;
const CX = W / 2;
const CY = H / 2 - 6;
const RX = 238;
const RY = 158;
const CORE = 46;
const NODE = 23;

/** Deterministic specks of "star dust" — the same sky on every render. */
const DUST = Array.from({ length: 64 }, (_, index) => ({
  x: (index * 97.3) % W,
  y: (index * 53.7 + (index % 7) * 31) % H,
  r: 0.6 + ((index * 13) % 9) / 10,
  duration: 2 + (index % 5),
}));

type AnalysisConstellationProps = {
  tasks: readonly AnalysisTask[];
  /** Pulsing and streaming while the checks run; still while waiting to start. */
  active: boolean;
  /** Named under the core — the project everything here is about. */
  projectName?: string;
};

/**
 * The analysis as a small universe: the project as a glowing core, every check as a planet
 * around it, each wired to the core by a curved line.
 *
 * While a check runs, light travels down its line towards the core; when it is done the planet
 * lights up in its area's colour and gets a tick (a cross if it failed). Drawn in one SVG with a
 * viewBox, so it scales to whatever width the dialog has instead of being shrunk by a transform.
 * The task list beside it says the same in words, so this is never the only way to read the
 * state; under reduced motion nothing moves.
 */
export function AnalysisConstellation({ tasks, active, projectName }: AnalysisConstellationProps) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const done = tasks.filter(
    (task) => task.status !== "pending" && task.status !== "running",
  ).length;

  const nodes = tasks.map((task, index) => {
    const angle = (index / tasks.length) * Math.PI * 2 - Math.PI / 2;
    const x = CX + Math.cos(angle) * RX;
    const y = CY + Math.sin(angle) * RY;
    // Bend each wire a little to one side, so the web reads as grown rather than ruled.
    const mx = (x + CX) / 2 + Math.sin(angle) * 34;
    const my = (y + CY) / 2 - Math.cos(angle) * 34;
    return { task, x, y, path: `M ${x} ${y} Q ${mx} ${my} ${CX} ${CY}` };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-[54rem]"
      role="img"
      aria-label={`${done} of ${tasks.length} checks finished`}
    >
      <defs>
        <radialGradient id={`${uid}-core`} cx="38%" cy="32%" r="70%">
          <stop offset="0%" style={{ stopColor: "var(--text)" }} />
          <stop offset="28%" style={{ stopColor: "var(--purple-text)" }} />
          <stop offset="72%" style={{ stopColor: "var(--brand)" }} />
          <stop offset="100%" style={{ stopColor: "var(--bg)" }} />
        </radialGradient>
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0%" style={{ stopColor: "var(--brand-text)", stopOpacity: 0.45 }} />
          <stop offset="100%" style={{ stopColor: "var(--brand-text)", stopOpacity: 0 }} />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Star dust. */}
      {DUST.map((speck, index) => (
        <circle
          key={index}
          cx={speck.x}
          cy={speck.y}
          r={speck.r}
          style={{ fill: "var(--text-muted)" }}
          opacity={0.25}
        >
          {!reduceMotion && (
            <animate
              attributeName="opacity"
              values="0.08;0.5;0.08"
              dur={`${speck.duration}s`}
              begin={`${(index % 10) * 0.3}s`}
              repeatCount="indefinite"
            />
          )}
        </circle>
      ))}

      {/* Orbits. */}
      {[0.42, 0.7, 1].map((scale) => (
        <ellipse
          key={scale}
          cx={CX}
          cy={CY}
          rx={RX * scale}
          ry={RY * scale}
          fill="none"
          strokeWidth={1}
          style={{ stroke: "var(--border-muted)" }}
          opacity={0.5}
        />
      ))}

      {/* Wires, and the light travelling down them. */}
      {nodes.map(({ task, path }, index) => {
        const color =
          task.status === "done"
            ? AREA_META[task.id].glow
            : task.status === "failed"
              ? "var(--danger-text)"
              : task.status === "running"
                ? "var(--brand-text)"
                : "var(--border-muted)";
        const lit = task.status === "done" || task.status === "running";

        return (
          <g key={task.id}>
            <path
              d={path}
              fill="none"
              strokeWidth={lit ? 1.8 : 1.2}
              strokeLinecap="round"
              style={{ stroke: color, transition: "stroke 400ms" }}
              opacity={lit ? 0.75 : 0.55}
              filter={lit ? `url(#${uid}-glow)` : undefined}
            />
            {task.status === "running" &&
              !reduceMotion &&
              [0, 0.55].map((delay) => (
                <circle
                  key={delay}
                  r={2.6}
                  style={{ fill: "var(--brand-text)" }}
                  filter={`url(#${uid}-glow)`}
                >
                  <animateMotion
                    dur="1.1s"
                    begin={`${delay + index * 0.07}s`}
                    repeatCount="indefinite"
                    path={path}
                  />
                </circle>
              ))}
          </g>
        );
      })}

      {/* The core. */}
      <circle cx={CX} cy={CY} r={CORE * 2.3} fill={`url(#${uid}-halo)`}>
        {active && !reduceMotion && (
          <animate
            attributeName="r"
            values={`${CORE * 2};${CORE * 2.6};${CORE * 2}`}
            dur="2.2s"
            repeatCount="indefinite"
          />
        )}
      </circle>
      <circle cx={CX} cy={CY} r={CORE} fill={`url(#${uid}-core)`} filter={`url(#${uid}-glow)`} />
      <text
        x={CX}
        y={CY + 6}
        textAnchor="middle"
        style={{ fill: "var(--text)", fontSize: 18, fontWeight: 700 }}
      >
        {done}/{tasks.length}
      </text>
      {projectName && (
        <text
          x={CX}
          y={CY + CORE + 22}
          textAnchor="middle"
          style={{ fill: "var(--text-muted)", fontSize: 12, fontWeight: 600, letterSpacing: 0.4 }}
        >
          {projectName}
        </text>
      )}

      {/* The checks. */}
      {nodes.map(({ task, x, y }) => {
        const Icon = AREA_META[task.id].icon;
        const lit = task.status === "done";
        const fill = lit
          ? AREA_META[task.id].glow
          : task.status === "failed"
            ? "var(--danger-text)"
            : task.status === "running"
              ? "var(--brand)"
              : "var(--surface-muted)";

        return (
          <g key={task.id}>
            {(lit || task.status === "running") && (
              <circle cx={x} cy={y} r={NODE + 8} style={{ fill }} opacity={0.18}>
                {task.status === "running" && !reduceMotion && (
                  <animate
                    attributeName="r"
                    values={`${NODE + 4};${NODE + 14};${NODE + 4}`}
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>
            )}
            <circle
              cx={x}
              cy={y}
              r={NODE}
              style={{
                fill,
                stroke: "var(--border-strong)",
                transition: "fill 400ms",
              }}
              strokeWidth={lit ? 0 : 1}
              filter={lit ? `url(#${uid}-glow)` : undefined}
              opacity={task.status === "pending" ? 0.85 : 1}
            />
            <Icon
              x={x - 10}
              y={y - 10}
              width={20}
              height={20}
              style={{
                color: lit || task.status === "running" ? "var(--bg)" : "var(--text-muted)",
              }}
              aria-hidden="true"
            />
            {(task.status === "done" || task.status === "failed") && (
              <g>
                <circle
                  cx={x + NODE * 0.72}
                  cy={y + NODE * 0.72}
                  r={8}
                  style={{
                    fill: task.status === "done" ? "var(--success-solid)" : "var(--danger-solid)",
                    stroke: "var(--bg)",
                  }}
                  strokeWidth={2}
                />
                <path
                  d={
                    task.status === "done"
                      ? `M ${x + NODE * 0.72 - 3.2} ${y + NODE * 0.72} l 2.2 2.2 l 4 -4.4`
                      : `M ${x + NODE * 0.72 - 3} ${y + NODE * 0.72 - 3} l 6 6 m 0 -6 l -6 6`
                  }
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ stroke: "var(--text)" }}
                />
              </g>
            )}
            <text
              x={x}
              y={y + NODE + 18}
              textAnchor="middle"
              style={{
                fill: lit ? "var(--text)" : "var(--text-muted)",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {AREA_META[task.id].label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
