/**
 * Deterministic pseudo-random in [0, 1) from a seed.
 *
 * Kept pure (no `Math.random`) so particle layouts can be built during render
 * without breaking React's purity rule, and so the same burst looks identical
 * across a re-render instead of visibly reshuffling mid-animation.
 */
export function seeded(seed: number): number {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}
