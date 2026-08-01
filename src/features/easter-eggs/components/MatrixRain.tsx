import { useEffect, useRef } from "react";

type MatrixRainProps = {
    /** Called when the effect finishes (~6s) or is dismissed (Escape). */
    onClose: () => void;
};

/**
 * MatrixRain
 *
 * A full-screen "Matrix digital rain" canvas effect, triggered as a chat
 * easter egg (type "matrix" / "the matrix" / "do matrix" in the chat
 * composer — see ChatPage). Renders a fixed, pointer-events-none canvas
 * above the app for ~6s, then auto-dismisses. Press Escape to dismiss early.
 *
 * Implementation notes:
 * - `onClose` is read through a ref so this effect has `[]` deps. ChatPage
 *   passes an inline arrow (`() => setIsMatrixActive(false)`) whose identity
 *   changes on every render; depending on it directly would tear down and
 *   restart the canvas + timers on each ChatPage re-render (e.g. while a
 *   streamed message arrives), making the rain flicker.
 * - The canvas is DPR-scaled for crisp rendering and recomputes its column
 *   count on resize.
 * - The palette is intentionally hardcoded black+green: this is a
 *   full-screen ambient takeover, not app UI, so the semantic design tokens
 *   (which describe app surfaces) don't apply here.
 */
export function MatrixRain({ onClose }: MatrixRainProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const onCloseRef = useRef(onClose);

    // Keep the ref in sync with the latest `onClose` without re-running the
    // canvas effect (see the implementation note above).
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const fontSize = 16;

        // Matrix characters (Katakana + Latin).
        const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]^~アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレゲゼデベペオォコソトノホモヨョロゴゾドボポヴッン".split(
                "",
            );

        let drops: number[] = [];

        const resize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const columns = Math.floor(w / fontSize);
            const next: number[] = [];
            for (let i = 0; i < columns; i++) {
                next[i] = drops[i] ?? 1;
            }
            drops = next;
        };
        resize();
        window.addEventListener("resize", resize);

        let isFadingOut = false;

        const draw = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;

            // Translucent black background to create the trail effect.
            ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = "#0F0"; // Green text
            ctx.font = `${fontSize}px monospace`;

            for (let i = 0; i < drops.length; i++) {
                // If a drop reached the bottom while fading out, skip it.
                if (isFadingOut && drops[i] * fontSize > h) {
                    continue;
                }

                const text = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);

                // Reset drop to top randomly, unless we are fading out.
                if (drops[i] * fontSize > h && Math.random() > 0.975) {
                    if (!isFadingOut) {
                        drops[i] = 0;
                    }
                }
                drops[i]++;
            }
        };

        const interval = setInterval(draw, 33);

        // Start fading out after 4 seconds.
        const fadeTimeout = setTimeout(() => {
            isFadingOut = true;
        }, 4000);

        // Close completely after 6 seconds (enough time to fall off screen).
        const closeTimeout = setTimeout(() => {
            onCloseRef.current();
        }, 6000);

        // Allow early dismissal via Escape (parity with DinoGame / SpaceInvaders).
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onCloseRef.current();
            }
        };
        window.addEventListener("keydown", onKeyDown);

        return () => {
            clearInterval(interval);
            clearTimeout(fadeTimeout);
            clearTimeout(closeTimeout);
            window.removeEventListener("resize", resize);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed top-0 left-0 w-full h-full pointer-events-none z-[9999]"
            style={{ display: "block" }}
            aria-hidden="true"
        />
    );
}
