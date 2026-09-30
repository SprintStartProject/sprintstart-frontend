import { useReducedMotion } from "framer-motion";
import { useId } from "react";
import { AREA_META } from "./analysisMeta";
import { NeonRing } from "./NeonRing";
import type { AnalysisTask } from "./useProjectAnalysis";

const W = 760;
const H = 480;
const CX = W / 2;
const CY = H / 2;

/** Three tilted orbits around the ring, from tight to wide. */
const ORBITS = [
  { rx: 170, ry: 58, tilt: -16, duration: 7 },
  { rx: 262, ry: 92, tilt: 12, duration: 10 },
  { rx: 350, ry: 128, tilt: -8, duration: 13 },
] as const;

/** Deterministic star dust — the same sky on every render. */
const DUST = Array.from({ length: 90 }, (_, index) => ({
  x: (index * 97.3 + (index % 3) * 17) % W,
  y: (index * 53.7 + (index % 7) * 31) % H,
  r: 0.5 + ((index * 13) % 9) / 11,
  duration: 2 + (index % 6),
}));

function ellipsePath(rx: number, ry: number): string {
  return `M ${CX - rx} ${CY} a ${rx} ${ry} 0 1 0 ${rx * 2} 0 a ${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
}

type AnalysisOrbitProps = {
  tasks: readonly AnalysisTask[];
  /** Moons travel and the ring's comet runs while the checks run. */
  active: boolean;
  projectName?: string;
};

/**
 * The scan, drawn as a small solar system: the project a ring of light in the middle, its checks
 * moons on three tilted orbits.
 *
 * A moon whose check is running travels its orbit; one that is done stops, lights up in its
 * area's colour and gets its name beside it; a failed one turns red. The ring fills as the checks
 * finish. The panel beside it says all of this in words — this is for the eye, and it stands still
 * under reduced motion.
 */
export function AnalysisOrbit({ tasks, active, projectName }: AnalysisOrbitProps) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const finished = tasks.filter(
    (task) => task.status !== "pending" && task.status !== "running",
  ).length;
  const percent = tasks.length === 0 ? 0 : Math.round((finished / tasks.length) * 100);

  return (
    <div className="relative mx-auto w-full max-w-[56rem]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${finished} of ${tasks.length} checks finished`}
      >
        <defs>
          <filter id={`${uid}-glow`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`${uid}-orbit`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: "var(--progress-fill)", stopOpacity: 0.12 }} />
            <stop offset="50%" style={{ stopColor: "var(--text-muted)", stopOpacity: 0.5 }} />
            <stop
              offset="100%"
              style={{ stopColor: "var(--progress-fill-end)", stopOpacity: 0.15 }}
            />
          </linearGradient>
        </defs>

        {DUST.map((speck, index) => (
          <circle
            key={index}
            cx={speck.x}
            cy={speck.y}
            r={speck.r}
            style={{ fill: "var(--brand-text)" }}
            opacity={0.3}
          >
            {!reduceMotion && (
              <animate
                attributeName="opacity"
                values="0.06;0.55;0.06"
                dur={`${speck.duration}s`}
                begin={`${(index % 11) * 0.27}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>
        ))}

        {ORBITS.map((orbit, orbitIndex) => {
          const onOrbit = tasks.filter((_, i) => i % ORBITS.length === orbitIndex).length;
          return (
            <g key={orbitIndex} transform={`rotate(${orbit.tilt} ${CX} ${CY})`}>
              <path
                d={ellipsePath(orbit.rx, orbit.ry)}
                fill="none"
                strokeWidth={1}
                stroke={`url(#${uid}-orbit)`}
              />
              {tasks.map((task, index) => {
                if (index % ORBITS.length !== orbitIndex) return null;
                // Spread the moons on one orbit evenly, and each orbit's set a little apart.
                const slot = Math.floor(index / ORBITS.length);
                const angle = ((slot / onOrbit) * 360 + orbitIndex * 50) * (Math.PI / 180);
                const x = CX + Math.cos(angle) * orbit.rx;
                const y = CY + Math.sin(angle) * orbit.ry;
                const meta = AREA_META[task.id];
                const running = task.status === "running";
                const done = task.status === "done" || task.status === "skipped";
                const failed = task.status === "failed";
                const color = failed
                  ? "var(--danger-text)"
                  : done
                    ? meta.glow
                    : running
                      ? "var(--brand-border-strong)"
                      : "var(--text-subtle)";
                const size = done || running ? 7 : 4.5;

                if (running && !reduceMotion) {
                  return (
                    <circle
                      key={task.id}
                      r={size}
                      style={{ fill: color }}
                      filter={`url(#${uid}-glow)`}
                    >
                      <animateMotion
                        dur={`${orbit.duration / 3}s`}
                        repeatCount="indefinite"
                        path={ellipsePath(orbit.rx, orbit.ry)}
                        begin={`-${slot * 0.7}s`}
                      />
                    </circle>
                  );
                }

                return (
                  <g key={task.id}>
                    {(done || failed) && (
                      <circle cx={x} cy={y} r={size * 2.4} style={{ fill: color }} opacity={0.16} />
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={size}
                      style={{ fill: color, transition: "fill 400ms" }}
                      filter={done || failed ? `url(#${uid}-glow)` : undefined}
                      opacity={task.status === "pending" ? 0.6 : 1}
                    />
                    {(done || failed) && (
                      <text
                        x={x}
                        y={y}
                        dx={12}
                        dy={4}
                        transform={`rotate(${-orbit.tilt} ${x} ${y})`}
                        style={{ fill: "var(--text)", fontSize: 12, fontWeight: 500 }}
                        opacity={0.85}
                      >
                        {meta.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Scaled with the orbits on a phone, where the SVG shrinks and a full-size ring would
          cover them. */}
      <div className="pointer-events-none absolute inset-0 flex scale-[0.62] items-center justify-center sm:scale-100">
        <NeonRing value={percent} size={188} active={active}>
          <span className="text-4xl leading-none font-bold text-app-text">{percent}%</span>
          <span className="mt-1.5 text-[11px] font-medium tracking-wider text-app-text-muted uppercase">
            {finished} of {tasks.length} checks
          </span>
          {projectName && (
            <span className="mt-1 max-w-32 truncate text-xs text-app-text-subtle">
              {projectName}
            </span>
          )}
        </NeonRing>
      </div>
    </div>
  );
}
