"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCache } from "./fetchCache";
import { http } from "./http";

interface Result<T> {
  key: string;
  data?: T;
  error?: Error;
}

/**
 * Fetches `path` (or nothing when null) and exposes loading/error state.
 *
 * What was loaded before for the same address shows at once (and is refreshed in the background, unless it is only a
 * few seconds old), see `fetchCache`. Previous data of the same path stays visible while reloading.
 */
export function useFetch<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);

  // First request of this address in this screen: whatever is remembered is shown while it is checked again.
  const remembered = path !== null && version === 0 ? fetchCache.peek(path) : null;

  useEffect(() => {
    if (path === null) return;
    let current = true;
    const key = `${path}|${version}`;
    // A manual reload (version > 0) always goes to the network; the first request may be satisfied by a recent answer
    // (which still arrives through here, so the screen is told about it even if it appeared after the first render).
    fetchCache
      .shared(path, () => http<T>(path), version === 0)
      .then((data) => current && setResult({ key, data: data as T }))
      .catch((error: Error) => current && setResult({ key, error }));
    return () => {
      current = false;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  const samePath = result !== null && result.key.startsWith(`${path}|`);
  const answered = result !== null && result.key === `${path}|${version}`;
  const loading = path !== null && !answered && !remembered;
  return {
    data: samePath && result.data !== undefined ? result.data : (remembered?.data as T | undefined),
    error: samePath && answered ? result.error : undefined,
    loading,
    reload,
  };
}
