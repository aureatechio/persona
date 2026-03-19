'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Smoothly interpolates a number from current display value to target.
 * Uses rAF when tab is visible, setTimeout fallback when hidden (TV display).
 * Duration: 16000ms ease-out quintic by default — slow, cinematic ramp.
 *
 * Stutter-free: tracks actual current value in a ref (not stale React state)
 * so mid-animation target changes blend seamlessly.
 *
 * IMPORTANT: `duration` is intentionally excluded from useEffect deps.
 * When isLive flips (changing the duration prop), we must NOT cancel
 * the running animation — it should continue to its target uninterrupted.
 */
export function useAnimatedValue(target: number, duration = 16000): number {
  const [display, setDisplay] = useState(target);
  const currentRef = useRef(target);       // actual displayed value (always up to date)
  const startValRef = useRef(target);
  const startTimeRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTargetRef = useRef(target);
  const durationRef = useRef(duration);
  durationRef.current = duration;

  useEffect(() => {
    // Skip animation if target hasn't changed
    if (prevTargetRef.current === target) return;
    prevTargetRef.current = target;

    // Start from whatever value is currently displayed (ref, not stale state)
    startValRef.current = currentRef.current;
    startTimeRef.current = Date.now();

    // Read latest duration from ref (not stale closure)
    const activeDuration = durationRef.current;

    const cleanup = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      frameRef.current = null;
      timerRef.current = null;
    };

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / activeDuration, 1);
      // ease-out quintic — much slower deceleration than cubic
      const eased = 1 - Math.pow(1 - progress, 5);
      const current = Math.round(
        startValRef.current + (target - startValRef.current) * eased,
      );
      currentRef.current = current;
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
  }, [target]); // duration intentionally excluded — see docstring

  return display;
}

/**
 * Component wrapper for useAnimatedValue — can be used inside .map() loops.
 * Renders the animated number as text, with optional suffix.
 */
export function AnimatedNumber({
  value,
  duration = 16000,
  suffix = '',
  format,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  format?: (n: number) => string;
}) {
  const animated = useAnimatedValue(value, duration);
  return <>{format ? format(animated) : animated}{suffix}</>;
}
