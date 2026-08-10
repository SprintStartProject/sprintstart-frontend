import { motion, useReducedMotion } from "framer-motion";

interface RocketGlyphProps {
  /** Edge length in px. The glyph is square and scales cleanly from ~20 up. */
  size?: number;
  /** Renders the exhaust flame below the nozzle. Off while the rocket is idle. */
  flame?: boolean;
  className?: string;
}

/**
 * The app's rocket, drawn rather than borrowed from the icon set.
 *
 * Two reasons it is not `lucide-react`'s `Rocket`: that glyph is locked to a
 * diagonal, so it can never be pointed along a flight path without looking
 * crooked, and as a hairline outline it disappears at the sizes these
 * animations need. This one points **straight up at 0°**, which lets callers
 * rotate it to whatever heading they are travelling on.
 *
 * It is built as a real craft rather than a pictogram — nose cone, livery band,
 * swept fins, nozzle, two-tone exhaust — because at the sizes it is used
 * (40–64px) a flat single-tone shape reads as an icon that happens to be
 * moving, not as an object with a front and a back.
 *
 * The hull is `currentColor`, so callers set the rocket's colour with a text
 * class. Only the warm parts (nose cone, flame) are fixed: they are what makes
 * the silhouette read as a rocket at a glance in either theme.
 */
export function RocketGlyph({ size = 24, flame = false, className }: RocketGlyphProps) {
  const reduceMotion = useReducedMotion();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Fins first, so the hull overlaps them cleanly at the joins. */}
      <path
        d="M7.65 13.1 4.25 18.6c-.4.65-.6 1.35-.6 2.1v1.05l4-2.35z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M16.35 13.1l3.4 5.5c.4.65.6 1.35.6 2.1v1.05l-4-2.35z"
        fill="currentColor"
        opacity="0.5"
      />

      {/* Nozzle, tucked under the hull so only its skirt shows. */}
      <path d="M9.6 17.9h4.8l-.75 2.4h-3.3z" fill="currentColor" opacity="0.75" />

      {/* Hull: nose cone tapering into a straight body. */}
      <path
        d="M12 1.2c2.75 2.6 4.35 6.7 4.35 10.9v5.5c0 .66-.54 1.2-1.2 1.2H8.85c-.66 0-1.2-.54-1.2-1.2v-5.5C7.65 7.9 9.25 3.8 12 1.2Z"
        fill="currentColor"
      />

      {/* Specular highlight down the barrel — what stops the hull reading
                as a flat cut-out at 40px and up. */}
      <ellipse cx="9.9" cy="12.8" rx="0.75" ry="3.6" fill="white" opacity="0.18" />

      {/* Livery band. Sits on the straight section of the hull (y 12.1 to
                17.6), so it meets both edges exactly at any size. */}
      <path d="M7.65 15.1h8.7v1.7H7.65z" fill="currentColor" opacity="0.35" />

      {/* Nose cone. Inset from the hull edge on purpose — flush would read
                as a lip and catch the eye as a drawing error while rotating. */}
      <path
        d="M12 1.2c1.45 1.4 2.62 3.3 3.32 5.5H8.68C9.38 4.5 10.55 2.6 12 1.2Z"
        className="fill-app-orange-text"
      />

      {/* Porthole, knocked out of the hull. */}
      <circle cx="12" cy="9.7" r="2.4" className="fill-app-surface" />
      <circle cx="12" cy="9.7" r="2.4" fill="currentColor" opacity="0.16" />
      <path
        d="M10.35 8.5a2.4 2.4 0 0 1 2.5-.75"
        stroke="white"
        strokeWidth="0.7"
        strokeLinecap="round"
        opacity="0.45"
      />

      {flame && (
        // Tip sits at y=23.2, not lower: the flicker scales the group to
        // 1.1x about its base (20.3), which reaches 23.49 — just inside
        // the 24-unit viewBox. A taller flame gets clipped at full stretch.
        <motion.g
          style={{ transformOrigin: "12px 20.3px" }}
          animate={
            reduceMotion
              ? undefined
              : { scaleY: [1, 0.62, 1.1, 0.8, 1], opacity: [1, 0.75, 1, 0.85, 1] }
          }
          transition={{ duration: 0.42, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M9.35 20.3h5.3c0 1.55-1.06 2.6-2.65 2.9-1.59-.3-2.65-1.35-2.65-2.9Z"
            className="fill-app-orange-text"
          />
          {/* Core is white over the orange rather than a second warm
                        token. The warm tokens are tuned for text contrast, so
                        they invert between themes — `warning-solid` is *darker*
                        than `orange-text` in dark mode, which would put a hole
                        in the middle of the flame. White always burns hotter
                        than whatever is behind it. */}
          <path
            d="M10.85 20.3h2.3c0 .95-.46 1.6-1.15 1.8-.69-.2-1.15-.85-1.15-1.8Z"
            fill="white"
            opacity="0.75"
          />
        </motion.g>
      )}
    </svg>
  );
}
