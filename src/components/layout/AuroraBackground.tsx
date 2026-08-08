import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { enterTransition } from "../../styles/tokens";
import { useTheme } from "../../context/useTheme";

export type AuroraVariant = "default" | "hero" | "subtle" | "login";

export type AuroraBackgroundProps = {
    /** Visual mood of the aurora. Defaults to `"default"`. */
    variant?: AuroraVariant;
    /** Optional grid overlay on top of the aurora blobs. Defaults to `true` (except `login` which defaults to `false`). */
    showGrid?: boolean;
    /** Whether the aurora reacts to the cursor with a subtle spotlight glow. Defaults to `true`. */
    interactive?: boolean;
    /** Optional content rendered above the background layer. */
    children?: ReactNode;
    className?: string;
};

type BlobConfig = {
    className: string;
    style?: React.CSSProperties;
}[];

const variantBlobs: Record<AuroraVariant, BlobConfig> = {
    default: [
        {
            className:
                "app-aurora absolute left-0 top-[10%] h-[600px] w-[600px] bg-app-glow opacity-80",
        },
        {
            className:
                "app-aurora app-aurora-alt absolute bottom-[-10%] right-[10%] h-[700px] w-[700px] bg-app-glow-accent opacity-60",
        },
    ],
    hero: [
        {
            className:
                "app-aurora absolute left-[-10%] top-[-15%] h-[34rem] w-[34rem] bg-app-glow opacity-80",
        },
        {
            className:
                "app-aurora app-aurora-alt absolute right-[-12%] top-[10%] h-[30rem] w-[30rem] bg-app-glow-accent opacity-60",
        },
        {
            className:
                "app-aurora absolute bottom-[-20%] left-[25%] h-[28rem] w-[28rem] bg-app-glow-alt opacity-50",
        },
    ],
    subtle: [
        {
            className:
                "app-aurora absolute left-[15%] top-[-10%] h-96 w-96 bg-app-glow opacity-50",
        },
        {
            className:
                "app-aurora app-aurora-alt absolute right-[5%] bottom-[-15%] h-80 w-80 bg-app-glow-accent opacity-40",
        },
    ],
    login: [
        {
            className:
                "app-aurora absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-app-brand/15",
        },
        {
            className:
                "app-aurora app-aurora-alt absolute -right-24 -bottom-40 h-[32rem] w-[32rem] rounded-full bg-app-accent/15",
            style: { animationDelay: "-8s" },
        },
        {
            className:
                "app-aurora absolute left-1/3 top-1/2 h-[20rem] w-[20rem] rounded-full bg-app-brand/10",
            style: { animationDelay: "-4s" },
        },
    ],
};

/**
 * Shared "Aurora Glass" page background.
 *
 * Renders slowly-drifting blurred gradient blobs (CSS keyframe-based)
 * and an optional interactive canvas spotlight that follows the cursor.
 *
 * When `interactive` is true (default), a subtle spotlight glow follows the
 * cursor across the background — implemented with rAF-throttled DOM-only
 * canvas writes (zero React re-renders).
 *
 * In Classic mode (`isClassicMode` from ThemeContext), the entire layer
 * is hidden — the CSS `.style-classic` rules handle the display:none.
 *
 * Render as the first child of a page root, with page content in a sibling
 * `relative z-10` container.
 *
 * The interactive canvas is oversized by OVERSCAN px on each side so the
 * glow stroke (max 160px wide) isn't clipped at the viewport edges.
 */
export function AuroraBackground({
    variant = "default",
    showGrid,
    interactive = true,
    children,
    className = "",
}: AuroraBackgroundProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { isClassicMode: classic } = useTheme();
    const effectiveInteractive = interactive && !classic;
    const effectiveGrid = (showGrid ?? variant !== "login") && !classic;
    const blobs = classic ? [] : variantBlobs[variant];

    // How many extra pixels to extend the canvas beyond the viewport on each
    // side, so the interactive glow trail isn't clipped at the screen edges.
    const OVERSCAN = 80;

    useEffect(() => {
        if (!effectiveInteractive) return;

        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;
        const ctx = canvas.getContext('2d');
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
        window.addEventListener('resize', resize);

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

            // Update ages and filter dead points (1000ms lifespan)
            points = points.map((p) => ({ ...p, age: p.age + dt })).filter((p) => p.age < 1000);

            if (points.length > 1) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                for (let i = 1; i < points.length; i++) {
                    const p1 = points[i - 1];
                    const p2 = points[i];
                    const life = 1 - p2.age / 1000; // 1.0 (new) to 0.0 (old)

                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(${getColor(life)}, ${life * 0.36})`;
                    ctx.lineWidth = 160 * life; // tapers from 160px down to 0
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
                // Add OVERSCAN offset because the canvas extends beyond
                // the container on each side.
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

        window.addEventListener('pointermove', handlePointerMove, { passive: true });

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('pointermove', handlePointerMove);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [effectiveInteractive, OVERSCAN]);

    return (
        <motion.div
            ref={containerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={enterTransition}
            aria-hidden={children === undefined ? true : undefined}
            className={`pointer-events-none fixed inset-0 ${className}`.trim()}
        >
            {effectiveInteractive ? (
                <canvas
                    ref={canvasRef}
                    aria-hidden
                    style={{
                        position: 'absolute',
                        left: -OVERSCAN,
                        top: -OVERSCAN,
                        width: `calc(100% + ${OVERSCAN * 2}px)`,
                        height: `calc(100% + ${OVERSCAN * 2}px)`,
                    }}
                    className="pointer-events-none blur-3xl dark:mix-blend-plus-lighter"
                />
            ) : null}
            {blobs.map((blob, index) => (
                <div key={index} className={blob.className} style={blob.style} />
            ))}
            {effectiveGrid ? <div className="app-bg-grid" /> : null}
            {children}
        </motion.div>
    );
}