/**
 * What the screens have already asked for, kept in memory for the life of the page.
 *
 * - **Stale while revalidate:** opening a screen again (back button, another tab of the same championship) shows what
 *   was loaded last time at once, and a fresh request updates it.
 * - **Shared requests:** two components asking for the same address at the same moment send one request.
 * - **Fresh window:** an answer younger than `FRESH_MS` is not asked for again (a screen and its children often ask
 *   for the same thing within a second).
 *
 * Any change made through the API (POST/PATCH/DELETE) or a different person signing in empties it, so what is
 * shown never lags behind what the person just did.
 */
export const FRESH_MS = 4_000;
/** Older than this is not shown any more: better a spinner than very old numbers. */
export const STALE_MAX_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 200;

interface Entry {
  data: unknown;
  at: number;
}

let entries = new Map<string, Entry>();
let inflight = new Map<string, Promise<unknown>>();
// Combined requests in flight (see `prefetch`): what they bring is stored as it arrives.
const batches = new Set<Promise<unknown>>();
// A request started before the cache was emptied must not put its (older) answer back in.
let generation = 0;

export const fetchCache = {
  /** The last answer for this address, if it is recent enough to show. */
  peek(path: string, now = Date.now()): { data: unknown; fresh: boolean } | null {
    const entry = entries.get(path);
    if (!entry || now - entry.at > STALE_MAX_MS) return null;
    return { data: entry.data, fresh: now - entry.at < FRESH_MS };
  },

  /** Stores an answer (also used to seed what a combined request already carried). */
  put(path: string, data: unknown, now = Date.now()): void {
    entries.delete(path);
    entries.set(path, { data, at: now });
    if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
  },

  /** Marks a combined request as running: anyone asking for something while it runs waits for it, as it may bring it. */
  trackBatch(request: Promise<unknown>): void {
    const done = request.catch(() => undefined);
    batches.add(done);
    void done.then(() => batches.delete(done));
  },

  /**
   * Runs `load` once for all callers asking for `path` at the same time, and remembers the answer. While a combined
   * request is in flight the caller waits for it first (it is probably carrying the answer); if it did not, or it
   * failed, `load` runs as usual. With `reuseFresh`, an answer from the last few seconds is returned as it is.
   */
  async shared<T>(path: string, load: () => Promise<T>, reuseFresh = false): Promise<T> {
    // A recent answer (a screen and its children often ask for the same thing within a second) needs no request at all.
    const recent = reuseFresh ? fetchCache.peek(path) : null;
    if (recent?.fresh) return recent.data as T;
    const running = inflight.get(path);
    if (running) return running as Promise<T>;
    const startedIn = generation;
    const start = () => {
      if (batches.size === 0) return load();
      return Promise.all([...batches]).then(() => {
        const brought = fetchCache.peek(path);
        return brought?.fresh ? (brought.data as T) : load();
      });
    };
    const promise = start()
      .then((data) => {
        if (generation === startedIn) fetchCache.put(path, data);
        return data;
      })
      .finally(() => {
        if (inflight.get(path) === promise) inflight.delete(path);
      });
    inflight.set(path, promise);
    return promise;
  },

  /** Changes every time the cache is emptied: an answer asked for under an older number may be from before the change. */
  generation(): number {
    return generation;
  },

  /** Forgets everything: something changed, or somebody else is looking now. */
  clear(): void {
    entries = new Map();
    inflight = new Map();
    batches.clear();
    generation += 1;
  },
};
