"use client";

import { useCallback, useEffect, useState } from "react";
import { http } from "./http";

interface Result<T> {
  key: string;
  data?: T;
  error?: Error;
}

/**
 * Fetches `path` (or nothing when null) and exposes loading/error state.
 * Previous data of the same path stays visible while reloading.
 */
export function useFetch<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);

  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    const key = `${path}|${version}`;
    http<T>(path, { signal: controller.signal })
      .then((data) => setResult({ key, data }))
      .catch((error: Error) => {
        if (error.name !== "AbortError") setResult({ key, error });
      });
    return () => controller.abort();
  }, [path, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  const samePath = result !== null && result.key.startsWith(`${path}|`);
  const loading = path !== null && (result === null || result.key !== `${path}|${version}`);
  return {
    data: samePath ? result.data : undefined,
    error: samePath && result.key === `${path}|${version}` ? result.error : undefined,
    loading,
    reload,
  };
}
