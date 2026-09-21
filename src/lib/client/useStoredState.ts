"use client";

import { useCallback, useState } from "react";

/**
 * useState that remembers its value in localStorage (a string). `allowed` guards against stale values: when the
 * stored one is not valid any more, the initial value is used. `forced` (e.g. from the URL) wins over the stored value. Only for client components rendered after data loads.
 */
export function useStoredState<T extends string>(key: string, initial: T, allowed?: (value: string) => boolean, forced?: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (forced !== undefined) {
      // A value coming from the URL is remembered too, so the filter survives leaving the page.
      try {
        window.localStorage.setItem(key, forced);
      } catch {
        // Not remembered when storage is unavailable.
      }
      return forced;
    }
    if (typeof window === "undefined") return initial;
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null && (!allowed || allowed(stored)) ? (stored as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Not remembered when storage is unavailable.
      }
    },
    [key]
  );
  return [value, set];
}
