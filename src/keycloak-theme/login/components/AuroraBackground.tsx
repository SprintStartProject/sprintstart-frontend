import { useEffect, useRef, useState } from "react";

const STYLE_STORAGE_KEY = "style-mode";
const AURORA_STORAGE_KEY = "sprintstart:aurora-enabled";

/**
 * Mirrors `ThemeProvider`'s `enabled = !classic && isAuroraEnabled` exactly
 * (src/context/ThemeProvider.tsx), without needing the provider itself:
 * `/auth` is served from the same origin as the app (see `nginx.conf` and
 * `vite.config.ts`'s dev proxy), so the same `localStorage` keys — and the
 * same default of "off" until the user opts in under Settings → Appearance —
 * apply here too.
 */
function readIsEnabled(): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
    if (window.localStorage.getItem(STYLE_STORAGE_KEY) === "classic") {
      return false;
    }
    return window.localStorage.getItem(AURORA_STORAGE_KEY) === "true";
  } catch {
    // localStorage unavailable (private mode, etc.) — stay off, same as the
    // app's own `getInitialAuroraEnabled` fallback.
    return false;
  }
}

/**
 * Login-theme port of the app's `AuroraBackground` (default variant only;
 * see src/components/layout/AuroraBackground.tsx).
 *
 * Same drifting blobs, blueprint grid and cursor-trail spotlight — kept
 * visually identical on purpose, including inheriting whatever the
 * `bg-app-glow`/`bg-app-glow-accent` tokens currently resolve to, so this
 * never drifts out of sync with the app's version if that gets touched later.
 *
 * What's intentionally different: no `ThemeContext` (there is no
 * `ThemeProvider` around the Keycloak login root) and no `framer-motion`
 * enter fade — this reads its two flags once on mount instead, the same way
 * `Template.tsx` already reads the `"theme"` key directly. A user who has
 * never enabled Aurora in Settings sees no difference at all; one who has
 * sees the same effect continue onto the login page.
 */
export function AuroraBackground() {
  // Lazy initializer: computed once, synchronously, on the initial render —
  // there is no server-rendered markup to reconcile against here, so there is
  // no hydration mismatch to avoid by deferring this to an effect.
  const [enabled] = useState(() => readIsEnabled());
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Half the maximum trail line width (160px) is enough to keep the glow
  // from clipping at the viewport edges.
  const OVERSCAN = 80;

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let points: { x: number; y: number; age: number }[] = [];
    let rafId = 0;
    let lastTime = performance.now();
    let isRunning = false;

    const resize = () => {
      canvas.width = window.innerWidth + OVERSCAN * 2;
      canvas.height = window.innerHeight + OVERSCAN * 2;
    };
    resize();
    window.addEventListener("resize", resize);

    const getColor = (life: number) => {
      let r, g, b;
      if (life > 0.5) {
        const t = (life - 0.5) * 2;
        r = Math.round(124 + (37 - 124) * t);
        g = Math.round(58 + (99 - 58) * t);
        b = Math.round(237 + (235 - 237) * t);
      } else {
        const t = life * 2;
        r = Math.round(16 + (124 - 16) * t);
        g = Math.round(185 + (58 - 185) * t);
        b = Math.round(129 + (237 - 129) * t);
      }
      return `${r}, ${g}, ${b}`;
    };

    const update = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      points = points.map((p) => ({ ...p, age: p.age + dt })).filter((p) => p.age < 1000);

      if (points.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1];
          const p2 = points[i];
          const life = 1 - p2.age / 1000;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(${getColor(life)}, ${life * 0.36})`;
          ctx.lineWidth = 160 * life;
          ctx.stroke();
        }
      }

      if (points.length > 0) {
        rafId = requestAnimationFrame(update);
      } else {
        isRunning = false;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      points.push({
        x: e.clientX - rect.left + OVERSCAN,
        y: e.clientY - rect.top + OVERSCAN,
        age: 0,
      });

      if (!isRunning) {
        isRunning = true;
        lastTime = performance.now();
        rafId = requestAnimationFrame(update);
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 0 }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: "absolute",
          left: -OVERSCAN,
          top: -OVERSCAN,
          width: `calc(100% + ${OVERSCAN * 2}px)`,
          height: `calc(100% + ${OVERSCAN * 2}px)`,
        }}
        className="pointer-events-none blur-3xl dark:mix-blend-plus-lighter"
      />
      <div className="app-aurora absolute left-0 top-[10%] h-[600px] w-[600px] bg-app-glow opacity-80" />
      <div className="app-aurora app-aurora-alt absolute bottom-[-10%] right-[10%] h-[700px] w-[700px] bg-app-glow-accent opacity-60" />
      <div className="app-bg-grid" />
    </div>
  );
}
