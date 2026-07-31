import { motion, useReducedMotion } from "framer-motion";

interface RocketGlyphProps {
    /** Edge length in px. The glyph is square and scales cleanly from ~16 up. */
    size?: number;
    /** Renders the exhaust flame below the fins. Off while the rocket is idle. */
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
 * The hull is `currentColor`; the porthole is punched out with the surface
 * token so the shape reads on any background in either theme.
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
                d="M7.7 13.2 4.3 18.1c-.3.5-.5 1-.5 1.6v1.6l4-2.4z"
                fill="currentColor"
                opacity="0.55"
            />
            <path
                d="M16.3 13.2l3.4 4.9c.3.5.5 1 .5 1.6v1.6l-4-2.4z"
                fill="currentColor"
                opacity="0.55"
            />

            {/* Hull: nose cone tapering into a straight body. */}
            <path
                d="M12 1.6c2.6 2.4 4.4 6.5 4.4 10.6v6.2c0 .5-.4.9-.9.9H8.5a.9.9 0 0 1-.9-.9v-6.2C7.6 8.1 9.4 4 12 1.6Z"
                fill="currentColor"
            />

            {/* Porthole, knocked out of the hull. */}
            <circle cx="12" cy="9.6" r="2.5" className="fill-app-surface" />
            <circle cx="12" cy="9.6" r="2.5" fill="currentColor" opacity="0.18" />

            {flame && (
                // Tip sits at y=23.2, not lower: the flicker scales it to 1.1x
                // about its base (19.6), which reaches 23.56 — just inside the
                // 24-unit viewBox. A taller flame gets clipped at full stretch.
                <motion.path
                    d="M9.7 19.6h4.6c0 1.8-.9 3.1-2.3 3.6-1.4-.5-2.3-1.8-2.3-3.6Z"
                    className="fill-app-orange-text"
                    style={{ transformOrigin: "12px 19.6px" }}
                    animate={
                        reduceMotion
                            ? undefined
                            : { scaleY: [1, 0.62, 1.1, 0.8, 1], opacity: [1, 0.75, 1, 0.85, 1] }
                    }
                    transition={{ duration: 0.42, repeat: Infinity, ease: "easeInOut" }}
                />
            )}
        </svg>
    );
}
