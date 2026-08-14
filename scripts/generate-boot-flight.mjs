/**
 * Generates the `boot-flight` keyframes that `index.html` uses for the boot
 * splash, from the same maths as `src/features/moments/loopFlight.ts`.
 *
 *     node scripts/generate-boot-flight.mjs
 *
 * Then paste the output over the existing `@keyframes boot-flight` block.
 *
 * Why generated rather than written by hand: the splash has to fly the app's
 * own curve — a prolate cycloid whose loop and travel are one parametric
 * expression, with the nose read back off the finished path — and none of those
 * numbers can be eyeballed. An approximation looks like a wobble where the loop
 * should be, which is exactly what this replaced.
 *
 * The output is normalised to the flight's own frame: +x runs along the flight,
 * -y is the side the loop bulges towards, and everything is a fraction of the
 * flight's length. `index.html` supplies the length and bearing per screen
 * shape as `--flight-d` and `--flight-angle`, so one set of keyframes serves
 * every viewport. Play it back `linear` — the easing is baked into the numbers.
 *
 * Keep the three constants below in step with `loopFlight.ts`; ANGLE_DEG is the
 * app's own flight vector (0.74 across the band, 0.42 up the viewport) resolved
 * at 16:9.
 */

/** Mirrors FLIGHT_STEPS in loopFlight.ts. */
const FLIGHT_STEPS = 60;
/** Mirrors TIP_IN in loopFlight.ts. */
const TIP_IN = 0.18;
/** Mirrors the default loopRatio of `loopFlight`. */
const LOOP_RATIO = 0.2;

const ANGLE_DEG = -17.71;
/** Emit every other sample: 31 keyframes is plenty for linear playback. */
const EVERY = 2;

const smoothstep = (t) => t * t * (3 - 2 * t);
const bearing = (dx, dy) => (Math.atan2(dx, -dy) * 180) / Math.PI;

const rad = (ANGLE_DEG * Math.PI) / 180;
const dx = Math.cos(rad);
const dy = Math.sin(rad);

const distance = Math.hypot(dx, dy);
const forwardX = dx / distance;
const forwardY = dy / distance;
const spin = bearing(forwardX, forwardY) > 0 ? -1 : 1;
const perpX = -spin * forwardY;
const perpY = spin * forwardX;
const radius = LOOP_RATIO * distance;

const xs = [];
const ys = [];
for (let step = 0; step <= FLIGHT_STEPS; step++) {
  const s = smoothstep(step / FLIGHT_STEPS);
  const angle = s * Math.PI * 2;
  const along = radius * Math.sin(angle);
  const across = radius * (1 - Math.cos(angle));
  xs.push(dx * s + forwardX * along + perpX * across);
  ys.push(dy * s + forwardY * along + perpY * across);
}

// Nose along the path, unwrapped, tipping in out of a resting angle of 0
// (straight up on screen) — same as loopFlight's noseAlongPath.
const rotate = [];
let previous = null;
for (let i = 0; i < xs.length; i++) {
  const before = Math.max(0, i - 1);
  const after = Math.min(xs.length - 1, i + 1);
  let angle = bearing(xs[after] - xs[before], ys[after] - ys[before]);
  if (previous !== null) angle += Math.round((previous - angle) / 360) * 360;
  previous = angle;

  const t = i / (xs.length - 1);
  if (t < TIP_IN) angle *= t / TIP_IN;
  rotate.push(angle);
}

// Screen space -> flight frame (the frame element carries rotate(ANGLE_DEG)).
const cos = Math.cos(-rad);
const sin = Math.sin(-rad);
const trim = (value) => String(Number(value.toFixed(4)));

const lines = [];
for (let i = 0; i <= FLIGHT_STEPS; i += EVERY) {
  const u = trim(xs[i] * cos - ys[i] * sin);
  const v = trim(xs[i] * sin + ys[i] * cos);
  const local = (rotate[i] - ANGLE_DEG).toFixed(1).replace(/\.0$/, "");
  const pct = String(Number(((i / FLIGHT_STEPS) * 100).toFixed(2)));

  lines.push(
    `        ${pct}% {\n` +
      `          transform: translate(calc(${u} * var(--flight-d)), calc(${v} * var(--flight-d)))\n` +
      `            rotate(${local}deg);\n` +
      `        }`,
  );
}

console.log(`      @keyframes boot-flight {\n${lines.join("\n")}\n      }`);

// Sanity check, the same one tests/unit/features/moments/flightGeometry.test.ts
// applies to loopFlight: a loop is a path that turns all the way round.
let turning = 0;
let heading = null;
for (let i = 1; i < xs.length; i++) {
  const stepX = xs[i] - xs[i - 1];
  const stepY = ys[i] - ys[i - 1];
  if (Math.hypot(stepX, stepY) < 1e-9) continue;
  const angle = Math.atan2(stepY, stepX);
  if (heading !== null) {
    let delta = angle - heading;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    turning += delta;
  }
  heading = angle;
}
console.error(`turning: ${((turning * 180) / Math.PI).toFixed(1)}deg (must be ~360)`);
