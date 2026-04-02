import { useEffect, useState } from 'react';

export const MOBILE_MAX_WIDTH = 639;
export const TABLET_MAX_WIDTH = 1023;

function readViewportWidth(): number {
  if (typeof window === 'undefined') return TABLET_MAX_WIDTH + 1;
  return window.innerWidth;
}

export interface ViewportBreakpointState {
  width: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchLayout: boolean;
}

export function useViewportBreakpoint(): ViewportBreakpointState {
  const [width, setWidth] = useState<number>(readViewportWidth);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Read window.innerWidth directly inside the handler to avoid stale closure
    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    // Sync on mount in case ResizeObserver on the document fired before this runs
    setWidth(window.innerWidth);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = width <= MOBILE_MAX_WIDTH;
  const isTablet = width > MOBILE_MAX_WIDTH && width <= TABLET_MAX_WIDTH;
  const isDesktop = width > TABLET_MAX_WIDTH;

  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
    isTouchLayout: width <= TABLET_MAX_WIDTH,
  };
}
