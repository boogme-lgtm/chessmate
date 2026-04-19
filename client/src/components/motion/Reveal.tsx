import React, { useEffect, useRef, useState } from "react";

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  threshold?: number;
}

/**
 * Editorial reveal primitive (brief spec).
 *
 * - 900ms cubic-bezier(0.2, 0.7, 0.2, 1), translateY(24px → 0) + opacity 0 → 1.
 * - Triggers on viewport intersection at the given threshold (default 0.12).
 * - Reveals immediately if the element is already in viewport on mount.
 * - 400ms fallback timer forces reveal even if IntersectionObserver fails
 *   (Safari edge cases, prerender, no-IO environments).
 *
 * Visual transition is owned by the .reveal / .reveal-in classes in
 * client/src/styles/glass.css.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as = "div",
  threshold = 0.12,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // 400ms safety: if IO never fires (or the element was already painted
    // visible) we still reveal so content never stays hidden.
    const safety = window.setTimeout(() => setShown(true), 400);

    // In-viewport-on-mount fallback: if the element is already visible at
    // mount time, reveal immediately rather than waiting for IO to fire.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setShown(true);
      window.clearTimeout(safety);
      return () => window.clearTimeout(safety);
    }

    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      window.clearTimeout(safety);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
          window.clearTimeout(safety);
        }
      },
      { threshold }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, [threshold]);

  const Tag = as as any;
  return (
    <Tag
      ref={ref}
      className={`reveal ${shown ? "reveal-in" : ""} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
