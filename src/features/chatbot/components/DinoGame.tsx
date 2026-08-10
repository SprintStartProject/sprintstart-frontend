import { useCallback, useEffect, useRef, useState } from "react";

type DinoGameProps = {
  /**
   * Called when the player leaves the game (Escape or the exit button).
   */
  onExit: () => void;
};

type Phase = "intro" | "play" | "over";

type Player = {
  x: number;
  y: number;
  vy: number;
  size: number;
  onGround: boolean;
};

type Obstacle = {
  kind: "cactus" | "drone";
  x: number;
  width: number;
  height: number;

  /**
   * Distance of the obstacle's bottom edge above the ground.
   * Cacti sit on the ground (0); drones hover at varying heights.
   */
  bottomOffset: number;

  /**
   * Phase offset for the drone's bobbing animation.
   */
  bobPhase: number;
};

type Cloud = {
  x: number;
  y: number;
  scale: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
};

type Toast = {
  x: number;
  y: number;
  text: string;
  life: number;
};

type World = {
  phase: Phase;
  player: Player;
  obstacles: Obstacle[];
  clouds: Cloud[];
  particles: Particle[];
  toasts: Toast[];
  speed: number;
  scoreF: number;
  lastMilestone: number;
  distanceSinceSpawn: number;
  nextGap: number;
  groundOffset: number;
  dustTimer: number;
  landTimer: number;
  shakeTimer: number;
  time: number;
  jumpHeld: boolean;
  jumpBuffer: number;
  duckHeld: boolean;
  width: number;
  height: number;
};

type Palette = {
  brand: string;
  brandText: string;
  text: string;
  textMuted: string;
  border: string;
  surface: string;
};

const LOGICAL_HEIGHT = 220;
const GRAVITY = 2200;
const FAST_FALL_GRAVITY = 3600;
const JUMP_VELOCITY = -780;

/**
 * Releasing the jump key while still rising caps the upward velocity at this
 * value, so tapping gives a short hop and holding gives the full jump arc.
 */
const JUMP_CUT_VELOCITY = -260;

/**
 * Pressing jump slightly before landing still triggers a jump on touchdown.
 */
const JUMP_BUFFER_TIME = 0.12;

const START_SPEED = 260;
const DRONE_MIN_SCORE = 40;
const HIGH_SCORE_KEY = "sprintstart-dino-highscore";

function loadHighScore(): number {
  const stored = Number(localStorage.getItem(HIGH_SCORE_KEY) ?? "0");
  return Number.isNaN(stored) ? 0 : stored;
}

function readPalette(el: HTMLElement): Palette {
  const styles = getComputedStyle(el);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

  return {
    brand: read("--brand", "#2563eb"),
    brandText: read("--brand-text", "#1d4ed8"),
    text: read("--text", "#111827"),
    textMuted: read("--text-muted", "#4b5563"),
    border: read("--border", "#e5e7eb"),
    surface: read("--surface", "#ffffff"),
  };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * DinoGame
 *
 * A tiny Chrome-dino style endless runner, hidden as an easter egg while the
 * assistant is thinking. The AI avatar drops in from above and the world
 * scrolls in from the right.
 *
 * Controls: hold Space / ArrowUp for a full jump, tap for a short hop,
 * ArrowDown / S ducks (and fast-falls midair), Escape leaves the game.
 * From score 40 on, drones join the cacti — duck under or jump over them.
 *
 * The whole game runs on a canvas driven by requestAnimationFrame; React state
 * is only used for the surrounding chrome (game-over overlay, score badge).
 */
export function DinoGame({ onExit }: DinoGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<Phase>("intro");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(loadHighScore);
  const [newHighScore, setNewHighScore] = useState(false);

  // Mutable game world, kept in a ref so the animation loop never restarts.
  const worldRef = useRef<World>({
    phase: "intro",
    player: { x: 56, y: -40, vy: 0, size: 34, onGround: false },
    obstacles: [],
    clouds: [],
    particles: [],
    toasts: [],
    speed: START_SPEED,
    scoreF: 0,
    lastMilestone: 0,
    distanceSinceSpawn: 0,
    nextGap: 320,
    groundOffset: 0,
    dustTimer: 0,
    landTimer: 0,
    shakeTimer: 0,
    time: 0,
    jumpHeld: false,
    jumpBuffer: 0,
    duckHeld: false,
    width: 600,
    height: LOGICAL_HEIGHT,
  });

  const paletteRef = useRef<Palette | null>(null);
  const highScoreRef = useRef(highScore);

  const resetWorld = useCallback(() => {
    const w = worldRef.current;

    w.phase = "intro";
    w.player = { x: 56, y: -40, vy: 0, size: 34, onGround: false }; // start above, drop in
    w.obstacles = [];
    w.particles = [];
    w.toasts = [];
    w.speed = START_SPEED;
    w.scoreF = 0;
    w.lastMilestone = 0;
    w.distanceSinceSpawn = 0;
    w.nextGap = 320;
    w.landTimer = 0;
    w.shakeTimer = 0;
    w.jumpBuffer = 0;
    setScore(0);
    setNewHighScore(false);
    setStatus("intro");
  }, []);

  const pressJump = useCallback(() => {
    const w = worldRef.current;
    w.jumpHeld = true;

    if (w.phase === "over") {
      resetWorld();
      return;
    }

    if (w.phase === "play") {
      if (w.player.onGround) {
        w.player.vy = JUMP_VELOCITY;
        w.player.onGround = false;
      } else {
        w.jumpBuffer = JUMP_BUFFER_TIME;
      }
    }
  }, [resetWorld]);

  const releaseJump = useCallback(() => {
    const w = worldRef.current;
    w.jumpHeld = false;
    w.jumpBuffer = 0;

    // Jump cut: releasing early shortens the jump.
    if (w.phase === "play" && w.player.vy < JUMP_CUT_VELOCITY) {
      w.player.vy = JUMP_CUT_VELOCITY;
    }
  }, []);

  // Keyboard + pointer controls.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
        return;
      }

      if (e.code === "Space" || e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        if (!e.repeat) pressJump();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "s") {
        e.preventDefault();
        worldRef.current.duckHeld = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "ArrowUp" || e.key === "w") {
        releaseJump();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "s") {
        worldRef.current.duckHeld = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [pressJump, releaseJump, onExit]);

  // The render + physics loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    paletteRef.current = readPalette(container);

    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const width = container.clientWidth;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      worldRef.current.width = width;
      worldRef.current.height = LOGICAL_HEIGHT;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(LOGICAL_HEIGHT * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${LOGICAL_HEIGHT}px`;
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Scatter a few background clouds across the sky.
    {
      const w = worldRef.current;
      if (w.clouds.length === 0) {
        for (let i = 0; i < 4; i++) {
          w.clouds.push({
            x: Math.random() * w.width,
            y: 18 + Math.random() * 70,
            scale: 0.7 + Math.random() * 0.8,
          });
        }
      }
    }

    let raf = 0;
    let last = performance.now();

    const drawCloud = (c: Cloud, palette: Palette) => {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = palette.textMuted;
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.arc(12, -4, 12, 0, Math.PI * 2);
      ctx.arc(26, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawCactus = (o: Obstacle, groundBottom: number, palette: Palette) => {
      const cx = o.x + o.width / 2;
      const top = groundBottom - o.height;
      const trunkW = Math.max(7, o.width * 0.42);

      ctx.strokeStyle = palette.textMuted;
      ctx.lineCap = "round";

      // Trunk
      ctx.lineWidth = trunkW;
      ctx.beginPath();
      ctx.moveTo(cx, groundBottom - 2);
      ctx.lineTo(cx, top + trunkW / 2);
      ctx.stroke();

      // Arms on taller cacti: out to the side, then up.
      if (o.height > 32) {
        const armW = trunkW * 0.7;
        const armY = top + o.height * 0.42;
        ctx.lineWidth = armW;

        ctx.beginPath();
        ctx.moveTo(cx, armY);
        ctx.lineTo(cx - o.width * 0.55, armY);
        ctx.lineTo(cx - o.width * 0.55, armY - o.height * 0.28);
        ctx.stroke();

        if (o.height > 42) {
          const armY2 = top + o.height * 0.6;
          ctx.beginPath();
          ctx.moveTo(cx, armY2);
          ctx.lineTo(cx + o.width * 0.55, armY2);
          ctx.lineTo(cx + o.width * 0.55, armY2 - o.height * 0.24);
          ctx.stroke();
        }
      }
    };

    const drawDrone = (o: Obstacle, groundBottom: number, time: number, palette: Palette) => {
      const bob = Math.sin(time * 5 + o.bobPhase) * 3;
      const bottom = groundBottom - o.bottomOffset + bob;
      const top = bottom - o.height;
      const cx = o.x + o.width / 2;

      ctx.fillStyle = palette.textMuted;
      ctx.strokeStyle = palette.textMuted;
      ctx.lineCap = "round";

      // Body
      roundedRect(ctx, o.x, top + 4, o.width, o.height - 4, 5);
      ctx.fill();

      // Rotor mast + spinning rotor (drawn as a flattening line).
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, top + 4);
      ctx.lineTo(cx, top);
      ctx.stroke();

      const rotor = Math.abs(Math.sin(time * 24 + o.bobPhase)) * 0.7 + 0.3;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 12 * rotor, top);
      ctx.lineTo(cx + 12 * rotor, top);
      ctx.stroke();

      // Eye
      ctx.fillStyle = palette.surface;
      ctx.beginPath();
      ctx.arc(o.x + o.width * 0.3, top + o.height * 0.55, 2.5, 0, Math.PI * 2);
      ctx.fill();
    };

    const spawnDust = (w: World, x: number, y: number, count: number, spread: number) => {
      for (let i = 0; i < count; i++) {
        if (w.particles.length > 40) w.particles.shift();
        w.particles.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y + Math.random() * 3,
          vx: -40 - Math.random() * spread,
          vy: -20 - Math.random() * 40,
          life: 0.4 + Math.random() * 0.25,
        });
      }
    };

    const spawnObstacle = (w: World) => {
      const canDrone = w.scoreF >= DRONE_MIN_SCORE;

      if (canDrone && Math.random() < 0.35) {
        // Drone: hovers low (jump over), mid (duck under) or high (fake-out).
        const roll = Math.random();
        const bottomOffset = roll < 0.35 ? 4 : roll < 0.8 ? 26 : 48;
        w.obstacles.push({
          kind: "drone",
          x: w.width + 30,
          width: 26,
          height: 14,
          bottomOffset,
          bobPhase: Math.random() * Math.PI * 2,
        });
        return;
      }

      const oh = 26 + Math.random() * 26;
      const ow = 16 + Math.random() * 14;
      w.obstacles.push({
        kind: "cactus",
        x: w.width + ow,
        width: ow,
        height: oh,
        bottomOffset: 0,
        bobPhase: 0,
      });

      // Occasionally a double cactus.
      if (Math.random() < 0.25) {
        w.obstacles.push({
          kind: "cactus",
          x: w.width + ow * 2 + 10,
          width: ow * 0.8,
          height: oh * 0.75,
          bottomOffset: 0,
          bobPhase: 0,
        });
      }
    };

    const drawPlayer = (w: World, palette: Palette) => {
      const p = w.player;
      const ducking = w.duckHeld && p.onGround && w.phase === "play";
      const tilt = Math.max(-0.3, Math.min(0.3, p.vy / 2800));

      // Squash on landing/duck, stretch while airborne.
      let scaleY = 1;
      if (ducking) {
        scaleY = 0.62;
      } else if (!p.onGround) {
        scaleY = 1 + Math.min(Math.abs(p.vy) / 4200, 0.14);
      } else if (w.landTimer > 0) {
        scaleY = 1 - w.landTimer * 1.4; // decays back to 1
      }
      const scaleX = 1 / scaleY;

      ctx.save();
      ctx.translate(p.x + p.size / 2, p.y + p.size);
      ctx.scale(scaleX, scaleY);
      ctx.translate(0, -p.size / 2);
      if (!ducking) ctx.rotate(tilt);

      // Body
      ctx.fillStyle = palette.brand;
      roundedRect(ctx, -p.size / 2, -p.size / 2, p.size, p.size, 10);
      ctx.fill();

      // Antenna
      ctx.strokeStyle = palette.brand;
      ctx.lineCap = "round";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -p.size / 2);
      ctx.lineTo(0, -p.size / 2 - 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -p.size / 2 - 9, 3, 0, Math.PI * 2);
      ctx.fill();

      // Eyes — squinting while ducking, x-ed out when the run is over.
      const eyeY = -2;
      const eyeOffset = p.size * 0.18;

      if (w.phase === "over") {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        for (const ex of [-eyeOffset, eyeOffset]) {
          ctx.beginPath();
          ctx.moveTo(ex - 3, eyeY - 3);
          ctx.lineTo(ex + 3, eyeY + 3);
          ctx.moveTo(ex + 3, eyeY - 3);
          ctx.lineTo(ex - 3, eyeY + 3);
          ctx.stroke();
        }
      } else if (ducking) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        for (const ex of [-eyeOffset, eyeOffset]) {
          ctx.beginPath();
          ctx.moveTo(ex - 3, eyeY);
          ctx.lineTo(ex + 3, eyeY);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(-eyeOffset, eyeY, 3.4, 0, Math.PI * 2);
        ctx.arc(eyeOffset, eyeY, 3.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = palette.brandText;
        ctx.beginPath();
        ctx.arc(-eyeOffset + 0.8, eyeY, 1.5, 0, Math.PI * 2);
        ctx.arc(eyeOffset + 0.8, eyeY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };

    const loop = (now: number) => {
      const w = worldRef.current;
      const palette = paletteRef.current ?? readPalette(container);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05; // clamp after tab switches

      w.time += dt;

      const width = w.width;
      const height = w.height;
      const groundY = height - 34;
      const playerBottom = groundY + w.player.size / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Screen shake right after a crash.
      if (w.shakeTimer > 0) {
        w.shakeTimer = Math.max(0, w.shakeTimer - dt);
        const intensity = w.shakeTimer * 14;
        ctx.translate((Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity);
      }

      // --- Clouds (slow parallax, always drifting a little) ---
      const cloudSpeed = w.phase === "play" ? w.speed * 0.14 : 12;
      for (const c of w.clouds) {
        c.x -= cloudSpeed * c.scale * 0.6 * dt;
        if (c.x < -60) {
          c.x = width + 40 + Math.random() * 80;
          c.y = 18 + Math.random() * 70;
          c.scale = 0.7 + Math.random() * 0.8;
        }
        drawCloud(c, palette);
      }

      // --- Ground line + moving dashes ---
      ctx.strokeStyle = palette.border;
      ctx.lineCap = "butt";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, playerBottom + 2);
      ctx.lineTo(width, playerBottom + 2);
      ctx.stroke();

      if (w.phase !== "intro") {
        w.groundOffset = (w.groundOffset + w.speed * dt) % 44;
      }
      const dashY = playerBottom + 12;
      for (let x = -w.groundOffset; x < width; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, dashY);
        ctx.lineTo(x + 20, dashY);
        ctx.stroke();
      }

      // --- Physics ---
      const wasAirborne = !w.player.onGround;

      if (w.phase === "intro") {
        w.player.vy += GRAVITY * dt;
        w.player.y += w.player.vy * dt;
        if (w.player.y + w.player.size >= playerBottom) {
          w.player.y = playerBottom - w.player.size;
          w.player.vy = 0;
          w.player.onGround = true;
          w.landTimer = 0.12;
          spawnDust(w, w.player.x + w.player.size / 2, playerBottom, 8, 80);
          w.phase = "play";
          setStatus("play");
        }
      } else if (w.phase === "play") {
        // Fast-fall while holding duck midair.
        const gravity = w.duckHeld && !w.player.onGround ? FAST_FALL_GRAVITY : GRAVITY;

        w.player.vy += gravity * dt;
        w.player.y += w.player.vy * dt;
        if (w.jumpBuffer > 0) w.jumpBuffer -= dt;

        if (w.player.y + w.player.size >= playerBottom) {
          w.player.y = playerBottom - w.player.size;
          w.player.vy = 0;
          w.player.onGround = true;
          if (wasAirborne) {
            w.landTimer = 0.12;
            spawnDust(w, w.player.x + w.player.size / 2, playerBottom, 5, 60);

            // Buffered jump: pressed shortly before landing.
            if (w.jumpBuffer > 0 && w.jumpHeld) {
              w.jumpBuffer = 0;
              w.player.vy = JUMP_VELOCITY;
              w.player.onGround = false;
            }
          }
        }

        if (w.landTimer > 0) w.landTimer = Math.max(0, w.landTimer - dt);

        // Running kicks up a little dust.
        if (w.player.onGround) {
          w.dustTimer -= dt;
          if (w.dustTimer <= 0) {
            w.dustTimer = 0.1;
            spawnDust(w, w.player.x + 4, playerBottom, 1, 30);
          }
        }

        // Speed + score ramp.
        w.scoreF += dt * 12;
        w.speed = START_SPEED + Math.min(w.scoreF * 2.4, 380);
        setScore(Math.floor(w.scoreF));

        // Milestone toast every 100 points.
        const milestone = Math.floor(w.scoreF / 100) * 100;
        if (milestone > w.lastMilestone) {
          w.lastMilestone = milestone;
          w.toasts.push({
            x: w.player.x + w.player.size + 14,
            y: w.player.y - 12,
            text: `${milestone}!`,
            life: 1,
          });
        }

        // Spawn obstacles based on distance travelled.
        w.distanceSinceSpawn += w.speed * dt;
        if (w.distanceSinceSpawn >= w.nextGap) {
          w.distanceSinceSpawn = 0;
          w.nextGap = 260 + Math.random() * 240;
          spawnObstacle(w);
        }

        // Move + cull obstacles.
        for (const o of w.obstacles) o.x -= w.speed * dt;
        w.obstacles = w.obstacles.filter((o) => o.x + o.width > -10);

        // Collision (with a little forgiveness padding).
        // Ducking shrinks the hitbox towards the ground.
        const ducking = w.duckHeld && w.player.onGround;
        const effHeight = ducking ? w.player.size * 0.55 : w.player.size;
        const pad = 5;
        const px = w.player.x + pad;
        const pw = w.player.size - pad * 2;
        const pBottom = w.player.y + w.player.size - pad;
        const pTop = w.player.y + (w.player.size - effHeight) + pad;

        for (const o of w.obstacles) {
          const bob = o.kind === "drone" ? Math.sin(w.time * 5 + o.bobPhase) * 3 : 0;
          const oBottom = playerBottom - o.bottomOffset + bob;
          const oTop = oBottom - o.height;

          if (px < o.x + o.width && px + pw > o.x && pTop < oBottom && pBottom > oTop) {
            w.phase = "over";
            w.shakeTimer = 0.3;
            setStatus("over");
            const finalScore = Math.floor(w.scoreF);
            if (finalScore > 0 && finalScore > highScoreRef.current) {
              highScoreRef.current = finalScore;
              setHighScore(finalScore);
              setNewHighScore(true);
              localStorage.setItem(HIGH_SCORE_KEY, String(finalScore));
            }
            break;
          }
        }
      }

      // --- Dust particles ---
      ctx.fillStyle = palette.textMuted;
      for (const pt of w.particles) {
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 300 * dt;
        if (pt.life <= 0) continue;
        ctx.globalAlpha = Math.min(pt.life * 1.6, 0.5);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      w.particles = w.particles.filter((pt) => pt.life > 0);

      // --- Milestone toasts (float up and fade) ---
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillStyle = palette.brandText;
      for (const t of w.toasts) {
        t.life -= dt;
        t.y -= 26 * dt;
        if (t.life <= 0) continue;
        ctx.globalAlpha = Math.min(t.life * 1.5, 1);
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
      w.toasts = w.toasts.filter((t) => t.life > 0);

      // --- Obstacles ---
      for (const o of w.obstacles) {
        if (o.kind === "drone") {
          drawDrone(o, playerBottom, w.time, palette);
        } else {
          drawCactus(o, playerBottom, palette);
        }
      }

      // --- Player ---
      drawPlayer(w, palette);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl border border-app-border bg-app-surface-muted"
      role="application"
      aria-label="Mini dino game — space jumps (hold for higher), arrow down ducks, escape exits"
    >
      <canvas
        ref={canvasRef}
        className="block w-full touch-none"
        onPointerDown={pressJump}
        onPointerUp={releaseJump}
        onPointerLeave={releaseJump}
      />

      {/* Top bar: score + exit */}
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
          className="pointer-events-auto rounded-md bg-app-surface/80 px-2 py-0.5 text-[11px] font-medium text-app-text-muted backdrop-blur-sm transition-colors hover:text-app-text"
        >
          Esc ✕
        </button>
      </div>

      {/* Controls hint */}
      {status !== "over" && (
        <div className="pointer-events-none absolute inset-x-0 top-9 flex justify-center">
          <span className="rounded bg-app-surface/70 px-2 py-0.5 text-[10px] text-app-text-disabled backdrop-blur-sm">
            Hold Space = high jump · ↓ duck
          </span>
        </div>
      )}

      {/* Game over overlay */}
      {status === "over" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-app-bg/60 backdrop-blur-[2px]">
          <p className="text-sm font-bold tracking-wide text-app-text">GAME OVER</p>

          {newHighScore ? (
            <div className="flex animate-bounce items-center gap-1.5 rounded-full bg-app-brand-soft px-3 py-1 text-xs font-bold text-app-brand-text ring-1 ring-app-brand-border">
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
              onClick={pressJump}
              className="rounded-lg bg-app-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-app-brand-hover"
            >
              Play Again (Space)
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded-lg border border-app-border px-3 py-1.5 text-xs font-medium text-app-text-muted transition-colors hover:text-app-text"
            >
              Exit (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
