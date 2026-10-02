import type { Schema } from "mongoose";

/**
 * A small in-memory cache for answers that are expensive to compute and the same for everybody (standings, stats,
 * the phase list...), so a screen opened by many people does the work once.
 *
 * It cannot go stale after a change made through this server: every write to a model (see `invalidateOnWrite`, wired
 * into each model) bumps one version number, and an entry only counts while that number is the one it was computed
 * with. A change made by another server instance, or straight in the database, is picked up when the entry's
 * time (`ttlMs`) runs out, so keep it short.
 */
let dataVersion = 0;

export const bumpDataVersion = (): void => {
  dataVersion += 1;
};

interface Entry {
  version: number;
  at: number;
  value: Promise<unknown>;
}

const store = new Map<string, Entry>();
const MAX_ENTRIES = 500;

/** Runs `load` unless a fresh answer for `key` exists; simultaneous callers share one run. A failure is not remembered. */
export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, now = Date.now()): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.version === dataVersion && now - hit.at < ttlMs) return hit.value as Promise<T>;
  // Tagged with the version it started under: a write while it runs makes the answer already out of date.
  const entry: Entry = { version: dataVersion, at: now, value: load() };
  entry.value.catch(() => {
    if (store.get(key) === entry) store.delete(key);
  });
  store.delete(key);
  store.set(key, entry);
  if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
  return entry.value as Promise<T>;
}

/** For tests. */
export function clearServerCache(): void {
  store.clear();
}

/** Models whose writes say nothing about what is cached: logging, notifications and who follows what. */
const IGNORED = new Set(["UsageEvent", "Notification", "AuditLog", "Follow", "PushSubscription"]);

const WRITE_HOOKS = [
  "save", "deleteOne", "updateOne", "updateMany", "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace",
  "replaceOne", "deleteMany", "insertMany", "bulkWrite",
] as const;

/** Registers on a schema the hooks that invalidate the cache after any write. Called once per model. */
export function invalidateOnWrite(schema: Schema, modelName: string): void {
  if (IGNORED.has(modelName)) return;
  for (const hook of WRITE_HOOKS) {
    // `post` hooks run after the write succeeded; the typing of the overloads is too narrow for a loop over names.
    (schema.post as (name: string, fn: () => void) => void)(hook, bumpDataVersion);
  }
}
