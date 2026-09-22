import { AsyncLocalStorage } from "node:async_hooks";
import type { Actor } from "./actor";

/**
 * Carries the actor resolved once per request (from the real session — see `src/auth.ts`) down to every
 * `getActor(request)` call without changing any of their call sites or making them async. Set by `route()`
 * in `src/lib/api.ts`; read by `getActor`.
 */
const storage = new AsyncLocalStorage<Actor>();

export function runWithActor<T>(actor: Actor, fn: () => Promise<T>): Promise<T> {
  return storage.run(actor, fn);
}

export function currentActor(): Actor | undefined {
  return storage.getStore();
}
