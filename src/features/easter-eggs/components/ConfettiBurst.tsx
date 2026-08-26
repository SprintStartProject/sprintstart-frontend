import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { clearEggEffect } from "../eggEffectBus";

/**
 * Confetti particle: position, velocity, spin and look. Plain mutable data —
 * the rAF loop owns it, React never reads it.
 */
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Rotation angle and per-particle spin speed (rad/s). */
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  shape: "rect" | "circle";
  /**
   * Phase of the paper-flutter oscillation. Advances faster while falling,
   * which is what turns ballistic arcs into tumbling paper.
   */
  wobblePhase: number;
  wobbleSpeed: number;
  age: number;
};

/** How long a particle lives at most, in seconds. */
const MAX_AGE_S = 3.5;
/** How long the reduced-motion chip stays before the effect clears (ms). */
const REDUCED_FADE_MS = 1500;
/** Gravity, px/s² — tuned so the arc peaks around mid-screen. */
const GRAVITY = 900;
/** Per-frame velocity damping (applied once per second worth of time). */
const DRAG = 0.99;
/** Particles fired from each of the two bottom cannons. */
const PARTICLES_PER_CANNON = 75;
/** Launch window: both cannons finish spawning within this many ms. */
const SPAWN_WINDOW_MS = 150;

const CANNON_ANGLES = {
  left: -Math.PI / 2 + Math.PI / 6, // up-and-inward from bottom-left
  right: -Math.PI / 2 - Math.PI / 6,
} as const;

/**
 * ConfettiBurst
 *
 * A full-screen canvas confetti celebration, triggered as a chat easter
 * egg (type "party" / "party time" / "let's party" / 🎉 into any chat
 * composer — see eggPhrases.ts). Two cannons at the bottom corners fire
 * ~150 paper particles up-and-inward; they tumble under gravity with air
 * drag and paper flutter until they leave the screen or expire (~3.5s),
 * then the canvas fades out and clears its bus effect.
 *
 * Implementation notes:
 * - Same contract as MatrixRain: all mutable state lives outside React,
 *   one delta-time-scaled rAF loop (identical motion on 60/144 Hz), DPR-
 *   aware canvas, cleanup cancels the frame and the resize listener.
 * - Colors are read ONCE from the app's CSS custom properties at spawn
 *   time, so the confetti follows the active light/dark theme and any
 *   future palette change without this file ever hardcoding hex values.
 * - Re-fire while running (the bus's `seq`) simply remounts this
 *   component via EggEffectsLayer's key, respawning the world.
 * - Reduced motion renders no particles at all — see ReducedPartyChip.
 */
export function ConfettiBurst() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Reduced motion: particle animation IS the effect, so there is no
  // honest way to keep it — show a static celebratory chip instead
  // (opacity-only fade), so typing "party" never disappears into a void.
  useEffect(() => {
    if (!prefersReducedMotion) return;
    const timeout = setTimeout(() => clearEggEffect(), REDUCED_FADE_MS);
    return () => clearTimeout(timeout);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    // The reduced-motion branch above owns the chip's timer; this effect
    // only runs the canvas. `prefersReducedMotion` is listed so the
    // linter sees the guard — flipping it remounts nothing because the
    // layer keys ConfettiBurst by seq, and a flip mid-burst simply ends
    // the burst, which is the correct outcome anyway.

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // No 2D context (very old browsers, some test environments): the
      // effect cannot render, so end it immediately instead of leaving a
      // stuck entry on the bus.
      clearEggEffect();
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let isFadingOut = false;

    const palette = readPalette();

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const world: Particle[] = [];

    const spawnCannon = (side: "left" | "right") => {
      const baseX = side === "left" ? 24 : window.innerWidth - 24;
      const baseAngle = CANNON_ANGLES[side];
      for (let i = 0; i < PARTICLES_PER_CANNON; i++) {
        // ±12° jitter around the cannon's base aim.
        const angle = baseAngle + (Math.random() - 0.5) * (Math.PI / 7.5);
        const speed = 520 + Math.random() * 380;
        world.push({
          x: baseX,
          y: window.innerHeight - 12,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 14,
          w: 6 + Math.random() * 5,
          h: 9 + Math.random() * 6,
          color: palette[Math.floor(Math.random() * palette.length)],
          shape: Math.random() < 0.75 ? "rect" : "circle",
          wobblePhase: Math.random() * Math.PI * 2,
          wobbleSpeed: 4 + Math.random() * 5,
          age: 0,
        });
      }
    };

    // Both cannons go off within the first 150ms rather than one instant,
    // so the burst reads as two pops instead of one wall of paper.
    const leftTimer = setTimeout(() => spawnCannon("left"), 0);
    const rightTimer = setTimeout(() => spawnCannon("right"), SPAWN_WINDOW_MS);

    let lastTime = performance.now();
    // The cannons spawn over the first 150ms, so the world is empty for
    // the first frames — wait for the first spawn before starting to
    // judge "everything has died" (otherwise the burst would fade out
    // before it began).
    let started = false;
    let rafId = 0;

    const draw = (now: number): void => {
      if (!started && world.length > 0) started = true;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const w = window.innerWidth;
      const h = window.innerHeight;

      if (!isFadingOut && world.length > 0) {
        ctx.clearRect(0, 0, w, h);
        for (let i = world.length - 1; i >= 0; i--) {
          const p = world[i];
          p.age += dt;
          p.vy += GRAVITY * dt;
          const dragFactor = Math.pow(DRAG, dt * 60);
          p.vx *= dragFactor;
          p.vy *= dragFactor;
          p.wobblePhase += p.wobbleSpeed * dt;
          p.x += p.vx * dt + Math.sin(p.wobblePhase) * 30 * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;

          if (p.age > MAX_AGE_S || p.y > h + 40 || p.x < -60 || p.x > w + 60) {
            world.splice(i, 1);
            continue;
          }

          // Tumbling paper: squash the rect along its rotation so it
          // flashes between full face and edge-on, like real confetti.
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          if (p.shape === "rect") {
            const flutterScale = 0.35 + 0.65 * Math.abs(Math.sin(p.wobblePhase));
            ctx.fillRect((-p.w * flutterScale) / 2, -p.h / 2, p.w * flutterScale, p.h);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      if (world.length === 0 && started) {
        if (!isFadingOut) {
          // Every particle has died (or was never spawned); fade the
          // canvas out over ~250ms before handing control back to the bus.
          isFadingOut = true;
          const el = canvasRef.current;
          if (!el) {
            clearEggEffect();
            return;
          }
          el.style.transition = "opacity 250ms ease-out";
          el.style.opacity = "0";
          setTimeout(() => clearEggEffect(), 280);
          return; // stop scheduling; fade runs on its own
        }
        return;
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(leftTimer);
      clearTimeout(rightTimer);
      window.removeEventListener("resize", resize);
    };
  }, [prefersReducedMotion]);

  return (
    <>
      {prefersReducedMotion ? (
        <div
          role="status"
          className="animate-fade-in shadow-card pointer-events-none fixed top-6 left-1/2 z-[9998] -translate-x-1/2 rounded-full border border-app-border bg-app-surface px-5 py-2.5 text-lg font-semibold"
        >
          🎉 Party!
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0 z-[9998] h-full w-full"
        />
      )}
    </>
  );
}

/**
 * Reads the confetti colors from the app's CSS custom properties.
 *
 * Uses the extended badge hues (brand, purple, pink, orange, amber/yellow)
 * — festive but still the app's own palette. Falls back to sensible colors
 * when getComputedStyle cannot resolve a variable (e.g. jsdom).
 */
function readPalette(): string[] {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return FALLBACK_PALETTE;
  }
  const styles = getComputedStyle(document.documentElement);
  const candidates = [
    "--color-app-brand",
    "--color-app-purple-text",
    "--color-app-pink-text",
    "--color-app-orange-text",
    "--color-app-yellow-text",
  ];
  const resolved = candidates.map((name) => styles.getPropertyValue(name).trim()).filter(Boolean);
  return resolved.length >= 3 ? resolved : FALLBACK_PALETTE;
}

const FALLBACK_PALETTE: string[] = ["#e11d48", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];
