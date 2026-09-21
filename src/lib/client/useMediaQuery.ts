"use client";

import { useSyncExternalStore } from "react";

/** Subscribes to a CSS media query. Renders `false` on the server so hydration always matches. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Phone-sized viewport (below the tablet breakpoint used by the stylesheet). */
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");
