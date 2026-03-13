'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Smoothly interpolates a number from current display value to target.
 * Uses rAF when tab is visible, setTimeout fallback when hidden (TV display).
 * Duration: 600ms ease-out cubic by default.
 */
export function useAnimatedValue(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const startValRef = useRef(target);
  const startTimeRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTargetRef = useRef(target);

  useEffect(() => {
    // Skip animation if target hasn't changed
    if (prevTargetRef.current === target) return;
    prevTargetRef.current = target;

    startValRef.current = display;
    startTimeRef.current = Date.now();

    const cleanup = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      frameRef.current = null;
      timerRef.current = null;
    };

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(
        startValRef.current + (target - startValRef.current) * eased,
      );
      setDisplay(current);

      if (progress < 1) {
        if (typeof requestAnimationFrame !== 'undefined' && !document.hidden) {
          frameRef.current = requestAnimationFrame(animate);
        } else {
          timerRef.current = setTimeout(animate, 32); // ~30fps fallback
        }
      }
    };

    cleanup();
    animate();

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}
