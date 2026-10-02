"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { screenBatchFor } from "@/lib/screenBatch";
import { fetchCache } from "./fetchCache";

interface BatchResponse {
  results: Record<string, { status: number; body: unknown }>;
}

/** The request the inline script of the page's HTML already sent (see `EarlyBatchScript`). */
declare global {
  interface Window {
    __earlyBatch?: { body: string; promise: Promise<BatchResponse | null> };
  }
}

const running = new Map<string, number>();
const DEDUPE_MS = 3_000;

function send(body: string): Promise<BatchResponse> {
  return fetch("/api/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body }).then((response) =>
    response.ok ? (response.json() as Promise<BatchResponse>) : Promise.reject(new Error(String(response.status)))
  );
}

/**
 * Asks the server for several things at once (`POST /api/batch`) and files the answers where `useFetch` looks for
 * them, so the screen's own requests find them already there instead of each making a trip. Anything the batch does
 * not bring, or all of it if the batch fails, is simply requested the usual way.
 *
 * In the paths, `:cid` is the real id of `championship` and `:route` the value itself (an id or a slug), both resolved
 * by the server, so a screen reached through a slug does not have to wait to learn the id. When the page's HTML already
 * sent this very request (first load), its answer is used instead of asking again.
 */
export function prefetch(paths: string[], championship?: string | null): void {
  if (paths.length < 2 || typeof window === "undefined") return;
  const body = JSON.stringify({ paths, ...(championship ? { championship } : {}) });
  const last = running.get(body);
  if (last && Date.now() - last < DEDUPE_MS) return;
  running.set(body, Date.now());

  const early = window.__earlyBatch;
  window.__earlyBatch = undefined;
  const response = early && early.body === body ? early.promise.then((answer) => answer ?? send(body)) : send(body);
  fetchCache.trackBatch(
    response.then(({ results }) => {
      for (const [path, result] of Object.entries(results)) if (result.status === 200) fetchCache.put(path, result.body);
    })
  );
}

/**
 * Starts the combined request for the screen in the address, on the first load and every time you move to another
 * screen. Layout effects run before the screens' own requests, so those wait for it instead of racing it.
 */
export function ScreenPrefetcher() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const batch = screenBatchFor(pathname);
    if (batch) prefetch(batch.paths, batch.championship);
  }, [pathname]);
  return null;
}
