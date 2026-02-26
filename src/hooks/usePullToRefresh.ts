import { useRef, useState, useCallback, useEffect } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<unknown>;
  threshold?: number;
  maxPull?: number;
}

export function usePullToRefresh({ onRefresh, threshold = 70, maxPull = 120 }: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy < 0) { pulling.current = false; setPullDistance(0); return; }
    // Dampen the pull
    const dampened = Math.min(dy * 0.45, maxPull);
    setPullDistance(dampened);
  }, [maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current && pullDistance === 0) return;
    pulling.current = false;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(threshold * 0.6);
      try { await onRefresh(); } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // We attach to the scrollable parent (main element)
    const scrollParent = el.closest("main") ?? el;
    scrollParent.addEventListener("touchstart", handleTouchStart, { passive: true });
    scrollParent.addEventListener("touchmove", handleTouchMove, { passive: true });
    scrollParent.addEventListener("touchend", handleTouchEnd);
    return () => {
      scrollParent.removeEventListener("touchstart", handleTouchStart);
      scrollParent.removeEventListener("touchmove", handleTouchMove);
      scrollParent.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const isTriggered = pullDistance >= threshold;

  return { containerRef, pullDistance, refreshing, isTriggered };
}
