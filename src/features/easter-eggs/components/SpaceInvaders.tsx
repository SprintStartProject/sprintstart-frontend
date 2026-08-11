import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { centralSpringToken } from "../../../styles/tokens";

type SpaceInvadersProps = {
  /**
   * Called when the player leaves the game (Escape or the exit button).
   */
  onExit: () => void;
};

type Phase = "intro" | "play" | "over" | "won";

type Player = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Vertical scale used for the shoot-recoil squash (eases back to 1). */
  scaleY: number;
};

type Alien = {
  /** Logical column index in the swarm grid. */
  col: number;
  /** Logical row index in the swarm grid. */
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  alive: boolean;
};

type Laser = {
  x: number;
  y: number;
  /** Always negative — lasers travel upward. */
  vy: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  /** Which palette color to use: alien debris vs. player explosion. */
  color: "alien" | "player";
};

type Toast = {
  x: number;
  y: number;
  text: string;
  life: number;
};

type Star = {
  x: number;
  y: number;
  r: number;
};

type World = {
  phase: Phase;
  player: Player;
  aliens: Alien[];
  lasers: Laser[];
  particles: Particle[];
  toasts: Toast[];
  stars: Star[];
  alienOffsetLeft: number;
  alienOffsetTop: number;
  direction: 1 | -1;
  alienSpeed: number;
  scoreF: number;
  lastMilestone: number;
  shootCooldown: number;
  shakeTimer: number;
  introTimer: number;
  /** Negative during the intro slide-in, eases to 0 at play. */
  introOffset: number;
  time: number;
  leftHeld: boolean;
  rightHeld: boolean;
  shootHeld: boolean;
  width: number;
  height: number;
};

type Palette = {
  brand: string;
  brandBorderStrong: string;
  dangerSolid: string;
  dangerText: string;
  text: string;
  textMuted: string;
  border: string;
  surface: string;
};

// --- Game constants (logical 600x400 coordinate space) ---

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const PLAYER_SPEED = 320;
const LASER_SPEED = 560;
const SHOOT_COOLDOWN = 0.35;
const ALIEN_BASE_SPEED = 28;
const ALIEN_SPEED_RAMP = 4.5;
const ALIEN_SPEED_CAP = 240;
const ALIEN_DROP = 18;
const ALIEN_ROWS = 4;
const ALIEN_COLS = 9;
const ALIEN_WIDTH = 30;
const ALIEN_HEIGHT = 20;
const ALIEN_PADDING = 15;
const ALIEN_OFFSET_TOP = 40;
const ALIEN_OFFSET_LEFT = 30;
const ALIEN_START_DROP = 220;
const INTRO_DURATION = 0.55;
const MILESTONE_STEP = 100;
const ALIEN_SCORE = 10;
const SHOT_RECOIL = 0.78;
const HIGH_SCORE_KEY = "sprintstart-invaders-highscore";

function loadHighScore(): number {
  const stored = Number(localStorage.getItem(HIGH_SCORE_KEY) ?? "0");
  return Number.isNaN(stored) ? 0 : stored;
}

/**
 * Reads the app's semantic design tokens from the computed style of the
 * container element so the canvas uses the *real* palette (and therefore
 * works in both light and dark themes automatically). Mirrors the approach
 * in {@link DinoGame} — never hardcode hex values in canvas drawing code.
 */
function readPalette(el: HTMLElement): Palette {
  const styles = getComputedStyle(el);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

  return {
    brand: read("--brand", "#2563eb"),
    brandBorderStrong: read("--brand-border-strong", "#3b82f6"),
    dangerSolid: read("--danger-solid", "#dc2626"),
    dangerText: read("--danger-text", "#b91c1c"),
    text: read("--text", "#111827"),
    textMuted: read("--text-muted", "#4b5563"),
    border: read("--border", "#e5e7eb"),
    surface: read("--surface", "#ffffff"),
  };
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function formationX(col: number): number {
  return ALIEN_OFFSET_LEFT + col * (ALIEN_WIDTH + ALIEN_PADDING);
}

function formationY(row: number): number {
  return ALIEN_OFFSET_TOP + row * (ALIEN_HEIGHT + ALIEN_PADDING);
}

function buildAliens(): Alien[] {
  const aliens: Alien[] = [];
  for (let r = 0; r < ALIEN_ROWS; r++) {
    for (let c = 0; c < ALIEN_COLS; c++) {
      aliens.push({
        col: c,
        row: r,
        x: formationX(c),
        y: formationY(r),
        width: ALIEN_WIDTH,
        height: ALIEN_HEIGHT,
        alive: true,
      });
    }
  }
  return aliens;
}

function buildStars(): Star[] {
  // Seeded once — static starfield for atmosphere. Deterministic so a
  // StrictMode double-mount doesn't reshuffle them.
  const stars: Star[] = [];
  let seed = 1337;
  const rand = () => {
    // LCG, deterministic
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 36; i++) {
    stars.push({
      x: rand() * CANVAS_WIDTH,
      y: rand() * (CANVAS_HEIGHT - 60),
      r: rand() * 1.1 + 0.3,
    });
  }
  return stars;
}

function initialWorld(): World {
  return {
    phase: "intro",
    player: {
      x: CANVAS_WIDTH / 2 - 15,
      y: CANVAS_HEIGHT - 30,
      width: 30,
      height: 15,
      scaleY: 1,
    },
    aliens: buildAliens(),
    lasers: [],
    particles: [],
    toasts: [],
    stars: buildStars(),
    alienOffsetLeft: 0,
    alienOffsetTop: 0,
    direction: 1,
    alienSpeed: ALIEN_BASE_SPEED,
    scoreF: 0,
    lastMilestone: 0,
    shootCooldown: 0,
    shakeTimer: 0,
    introTimer: 0,
    introOffset: -ALIEN_START_DROP,
    time: 0,
    leftHeld: false,
    rightHeld: false,
    shootHeld: false,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  };
}

function spawnAlienDebris(w: World, x: number, y: number): void {
  for (let i = 0; i < 10; i++) {
    if (w.particles.length > 60) w.particles.shift();
    w.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 160,
      vy: (Math.random() - 0.5) * 160 - 40,
      life: 0.4 + Math.random() * 0.25,
      color: "alien",
    });
  }
}

function spawnPlayerExplosion(w: World, x: number, y: number): void {
  for (let i = 0; i < 18; i++) {
    if (w.particles.length > 80) w.particles.shift();
    w.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 260,
      vy: (Math.random() - 0.5) * 260,
      life: 0.5 + Math.random() * 0.35,
      color: "player",
    });
  }
}

/**
 * SpaceInvaders
 *
 * A canvas Space Invaders clone, hidden as an easter egg on the 404 page
 * and reachable from the dashboard via the Ctrl+Shift+3 chord (see
 * {@link SpaceInvadersModal}).
 *
 * Architecture mirrors {@link DinoGame}: all mutable game state lives in a
 * single `useRef<World>` so the `requestAnimationFrame` loop never restarts
 * and never captures stale React state; React state is only used for the
 * surrounding chrome (score badge, game-over overlay). Motion is scaled by
 * delta-time so the game runs identically on 60Hz and 144Hz displays, and
 * the canvas is DPR-aware for crisp rendering on retina.
 *
 * Controls: ArrowLeft / ArrowRight (or A / D) move, Space shoots (hold to
 * auto-fire on cooldown), Escape leaves the game. On the game-over or win
 * screen, Space or the Play Again button restarts in place (no page reload).
 *
 * Palette: read from the app's semantic CSS tokens at runtime via
 * {@link readPalette}, so the game looks correct in both light and dark
 * themes — no hardcoded hex values.
 */
export function SpaceInvaders({ onExit }: SpaceInvadersProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<Phase>("intro");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(loadHighScore);
  const [newHighScore, setNewHighScore] = useState(false);

  const worldRef = useRef<World>(initialWorld());
  const paletteRef = useRef<Palette | null>(null);
  const highScoreRef = useRef(highScore);

  const resetWorld = useCallback(() => {
    const w = worldRef.current;
    const stars = w.stars; // preserve starfield across restarts
    Object.assign(w, initialWorld());
    w.stars = stars;
    setScore(0);
    setNewHighScore(false);
    setStatus("intro");
  }, []);

  const pressShoot = useCallback(() => {
    const w = worldRef.current;
    w.shootHeld = true;

    if (w.phase === "over" || w.phase === "won") {
      resetWorld();
      return;
    }
    // The actual laser spawn is driven by the cooldown in the update
    // loop (hold-to-autofire); here we just arm the intent.
  }, [resetWorld]);

  const releaseShoot = useCallback(() => {
    worldRef.current.shootHeld = false;
  }, []);

  // --- Keyboard input (Escape, Space, Arrows / A-D) ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) pressShoot();
        return;
      }

      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        worldRef.current.leftHeld = true;
        return;
      }

      if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        worldRef.current.rightHeld = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        releaseShoot();
        return;
      }
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        worldRef.current.leftHeld = false;
        return;
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        worldRef.current.rightHeld = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [pressShoot, releaseShoot, onExit]);

  // --- Render + physics loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    paletteRef.current = readPalette(container);

    // Fixed logical coordinate space (600x400); the bitmap is DPR-scaled
    // for crispness and CSS scales it down on narrow viewports. Unlike
    // DinoGame's responsive width, Space Invaders has a fixed swarm grid
    // so a fixed logical width is the right model.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(CANVAS_WIDTH * dpr);
    canvas.height = Math.floor(CANVAS_HEIGHT * dpr);

    let raf = 0;
    let last = performance.now();

    const drawStars = (w: World, palette: Palette) => {
      ctx.fillStyle = palette.textMuted;
      for (const s of w.stars) {
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawAlien = (a: Alien, palette: Palette, time: number) => {
      ctx.fillStyle = palette.dangerSolid;
      // Body
      ctx.fillRect(a.x, a.y, a.width, a.height);
      // Legs (two small nubs)
      ctx.fillRect(a.x + 3, a.y + a.height, 5, 4);
      ctx.fillRect(a.x + a.width - 8, a.y + a.height, 5, 4);
      // Eyes — blink on a slow phase per row so the swarm shimmers.
      const blink = Math.sin(time * 3 + a.row * 0.7) > 0.6;
      ctx.fillStyle = blink ? palette.surface : palette.dangerSolid;
      ctx.fillRect(a.x + 7, a.y + 6, 4, 4);
      ctx.fillRect(a.x + a.width - 11, a.y + 6, 4, 4);
    };

    const drawAliens = (w: World, palette: Palette) => {
      for (const a of w.aliens) {
        if (a.alive) drawAlien(a, palette, w.time);
      }
    };

    const drawLasers = (w: World, palette: Palette) => {
      ctx.fillStyle = palette.brandBorderStrong;
      for (const l of w.lasers) {
        ctx.fillRect(l.x, l.y, 4, 10);
      }
    };

    const drawPlayer = (w: World, palette: Palette) => {
      const p = w.player;
      ctx.save();
      ctx.translate(p.x + p.width / 2, p.y + p.height);
      ctx.scale(1 / p.scaleY, p.scaleY);
      ctx.translate(0, -p.height / 2);

      ctx.fillStyle = palette.brand;
      // Hull
      ctx.fillRect(-p.width / 2, 0, p.width, p.height);
      // Cannon
      ctx.fillRect(-5, -5, 10, 5);
      // Treads
      ctx.fillRect(-p.width / 2, -2, 5, 3);
      ctx.fillRect(p.width / 2 - 5, -2, 5, 3);

      ctx.restore();
    };

    const drawParticles = (w: World, palette: Palette) => {
      for (const pt of w.particles) {
        ctx.globalAlpha = Math.min(pt.life * 1.6, 0.8);
        ctx.fillStyle = pt.color === "alien" ? palette.dangerText : palette.brand;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawToasts = (w: World, palette: Palette) => {
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillStyle = palette.brandBorderStrong;
      for (const t of w.toasts) {
        ctx.globalAlpha = Math.min(t.life * 1.5, 1);
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    };

    const finalize = (w: World) => {
      const finalScore = Math.floor(w.scoreF);
      if (finalScore > 0 && finalScore > highScoreRef.current) {
        highScoreRef.current = finalScore;
        setHighScore(finalScore);
        setNewHighScore(true);
        try {
          localStorage.setItem(HIGH_SCORE_KEY, String(finalScore));
        } catch (error) {
          console.warn("Failed to persist invaders high score", error);
        }
      }
    };

    const updateIntro = (w: World, dt: number) => {
      w.introTimer += dt;
      const t = Math.min(1, w.introTimer / INTRO_DURATION);
      w.introOffset = -ALIEN_START_DROP * (1 - easeOutCubic(t));
      for (const a of w.aliens) {
        a.x = formationX(a.col) + w.alienOffsetLeft;
        a.y = formationY(a.row) + w.alienOffsetTop + w.introOffset;
      }
      if (t >= 1) {
        w.introOffset = 0;
        w.phase = "play";
        setStatus("play");
      }
    };

    const updatePlay = (w: World, dt: number) => {
      // Player movement.
      if (w.leftHeld) w.player.x -= PLAYER_SPEED * dt;
      if (w.rightHeld) w.player.x += PLAYER_SPEED * dt;
      w.player.x = Math.max(0, Math.min(CANVAS_WIDTH - w.player.width, w.player.x));

      // Recoil squash eases back to 1.
      w.player.scaleY += (1 - w.player.scaleY) * Math.min(1, dt * 12);

      // Shoot cooldown + hold-to-autofire.
      w.shootCooldown = Math.max(0, w.shootCooldown - dt);
      if (w.shootHeld && w.shootCooldown === 0) {
        const muzzleX = w.player.x + w.player.width / 2 - 2;
        w.lasers.push({ x: muzzleX, y: w.player.y, vy: -LASER_SPEED });
        w.shootCooldown = SHOOT_COOLDOWN;
        w.player.scaleY = SHOT_RECOIL;
      }

      // Alien speed ramps as the swarm thins (classic Invaders).
      const aliveAliens = w.aliens.filter((a) => a.alive);
      const killed = ALIEN_ROWS * ALIEN_COLS - aliveAliens.length;
      w.alienSpeed = Math.min(ALIEN_BASE_SPEED + killed * ALIEN_SPEED_RAMP, ALIEN_SPEED_CAP);

      // Swarm horizontal movement + wall bounce (drop on hit).
      let minX = Infinity;
      let maxX = -Infinity;
      for (const a of aliveAliens) {
        const ax = formationX(a.col) + w.alienOffsetLeft;
        if (ax < minX) minX = ax;
        if (ax + a.width > maxX) maxX = ax + a.width;
      }
      const dx = w.direction * w.alienSpeed * dt;
      if (aliveAliens.length > 0 && (minX + dx <= 0 || maxX + dx >= CANVAS_WIDTH)) {
        w.direction = w.direction === 1 ? -1 : 1;
        w.alienOffsetTop += ALIEN_DROP;
      } else {
        w.alienOffsetLeft += dx;
      }

      // Recompute alien positions for collision + draw.
      for (const a of w.aliens) {
        if (!a.alive) continue;
        a.x = formationX(a.col) + w.alienOffsetLeft;
        a.y = formationY(a.row) + w.alienOffsetTop + w.introOffset;
      }

      // Laser movement + cull.
      for (const l of w.lasers) l.y += l.vy * dt;
      w.lasers = w.lasers.filter((l) => l.y > -10);

      // Collision: laser vs alien.
      for (const a of w.aliens) {
        if (!a.alive) continue;
        for (let i = 0; i < w.lasers.length; i++) {
          const l = w.lasers[i];
          if (l.x > a.x && l.x < a.x + a.width && l.y > a.y && l.y < a.y + a.height) {
            a.alive = false;
            w.lasers.splice(i, 1);
            i--;
            w.scoreF += ALIEN_SCORE;
            setScore(Math.floor(w.scoreF));
            spawnAlienDebris(w, a.x + a.width / 2, a.y + a.height / 2);

            const milestone = Math.floor(w.scoreF / MILESTONE_STEP) * MILESTONE_STEP;
            if (milestone > w.lastMilestone) {
              w.lastMilestone = milestone;
              w.toasts.push({
                x: a.x,
                y: a.y - 6,
                text: `${milestone}!`,
                life: 1,
              });
            }
            break;
          }
        }
      }

      // Win: swarm cleared.
      if (w.aliens.every((a) => !a.alive)) {
        w.phase = "won";
        setStatus("won");
        finalize(w);
        return;
      }

      // Lose: an alien reached the player's row.
      for (const a of w.aliens) {
        if (a.alive && a.y + a.height >= w.player.y) {
          w.phase = "over";
          w.shakeTimer = 0.4;
          spawnPlayerExplosion(
            w,
            w.player.x + w.player.width / 2,
            w.player.y + w.player.height / 2,
          );
          setStatus("over");
          finalize(w);
          break;
        }
      }
    };

    const updateParticles = (w: World, dt: number) => {
      for (const pt of w.particles) {
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 300 * dt;
      }
      w.particles = w.particles.filter((pt) => pt.life > 0);
    };

    const updateToasts = (w: World, dt: number) => {
      for (const t of w.toasts) {
        t.life -= dt;
        t.y -= 26 * dt;
      }
      w.toasts = w.toasts.filter((t) => t.life > 0);
    };

    const loop = (now: number) => {
      const w = worldRef.current;
      const palette = paletteRef.current ?? readPalette(container);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05; // clamp after tab switches
      w.time += dt;

      if (w.phase === "intro") updateIntro(w, dt);
      else if (w.phase === "play") updatePlay(w, dt);

      // Cosmetic updates keep running on over/won so debris fades.
      updateParticles(w, dt);
      updateToasts(w, dt);
      if (w.shakeTimer > 0) w.shakeTimer = Math.max(0, w.shakeTimer - dt);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (w.shakeTimer > 0) {
        const intensity = w.shakeTimer * 14;
        ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
      }

      drawStars(w, palette);
      drawAliens(w, palette);
      drawLasers(w, palette);
      drawParticles(w, palette);
      drawToasts(w, palette);
      drawPlayer(w, palette);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  const isOver = status === "over" || status === "won";

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[600px] overflow-hidden rounded-2xl border border-app-border bg-app-surface-muted"
      role="application"
      aria-label="Mini space invaders game — arrow keys or A/D move, space shoots, escape exits"
      data-testid="invaders-game"
    >
      <canvas
        ref={canvasRef}
        className="block h-auto w-full touch-none"
        onPointerDown={pressShoot}
        onPointerUp={releaseShoot}
        onPointerLeave={releaseShoot}
      />

      {/* Top bar: high score + score + exit */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-app-surface/80 px-2 py-0.5 text-[11px] font-semibold text-app-text-muted tabular-nums backdrop-blur-sm">
            HI {String(highScore).padStart(5, "0")}
          </span>
          <span className="rounded-md bg-app-surface/80 px-2 py-0.5 text-[11px] font-bold text-app-text tabular-nums backdrop-blur-sm">
            {String(score).padStart(5, "0")}
          </span>
        </div>

        <button
          type="button"
          onClick={onExit}
          data-testid="invaders-exit"
          className="pointer-events-auto rounded-md bg-app-surface/80 px-2 py-0.5 text-[11px] font-medium text-app-text-muted backdrop-blur-sm transition-colors hover:text-app-text"
        >
          Esc ✕
        </button>
      </div>

      {/* Controls hint */}
      {!isOver && (
        <div className="pointer-events-none absolute inset-x-0 top-9 flex justify-center">
          <span className="rounded bg-app-surface/70 px-2 py-0.5 text-[10px] text-app-text-disabled backdrop-blur-sm">
            ← → move · Space shoot
          </span>
        </div>
      )}

      {/* Game over / win overlay */}
      <AnimatePresence>
        {isOver && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-app-bg/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={centralSpringToken}
          >
            <p className="text-sm font-bold tracking-wide text-app-text">
              {status === "won" ? "GALAXY SAVED!" : "MISSION FAILED"}
            </p>

            {newHighScore ? (
              <div className="flex items-center gap-1.5 rounded-full bg-app-brand-soft px-3 py-1 text-xs font-bold text-app-brand-text ring-1 ring-app-brand-border">
                <span>🏆</span>
                <span>New High Score! {score}</span>
              </div>
            ) : (
              <p className="text-xs text-app-text-muted">
                Score {score} · Best {highScore}
              </p>
            )}

            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={pressShoot}
                data-testid="invaders-play-again"
                className="rounded-lg bg-app-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-app-brand-hover"
              >
                Play Again (Space)
              </button>
              <button
                type="button"
                onClick={onExit}
                data-testid="invaders-exit-overlay"
                className="rounded-lg border border-app-border px-3 py-1.5 text-xs font-medium text-app-text-muted transition-colors hover:text-app-text"
              >
                Exit (Esc)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
