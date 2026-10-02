import { HttpError } from "./http";

/**
 * Attendance changes made without a connection. They are kept on the device (localStorage) and replayed in order
 * once the network is back; each one carries the time it really happened (`occurredAt`) so the server records that
 * time and can tell whether somebody else changed the same player meanwhile (see `lib/rules/offline`).
 */
export interface OutboxOp {
  id: string;
  matchId: string;
  /** API path (without `/api`) and body, replayed as a POST. */
  path: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

/** A change the server refused for good (not called up any more, match closed, somebody else was newer...). */
export interface RejectedOp {
  op: OutboxOp;
  message: string;
}

export interface OutboxState {
  pending: OutboxOp[];
  rejected: RejectedOp[];
  /** Bumped every time at least one op reached the server, so screens can reload their data. */
  syncedCount: number;
  /** Replaying stopped because the person has to sign in again. */
  needsSignIn: boolean;
  flushing: boolean;
}

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface Deps {
  storage: Storage | null;
  send: (path: string, payload: Record<string, unknown>) => Promise<unknown>;
  now?: () => Date;
  newId?: () => string;
}

const KEY = "super-torneos:outbox:v1";

/** A failure of the connection itself (or of a server that is down): worth retrying later. */
export function isConnectionError(error: unknown): boolean {
  return error instanceof HttpError && (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504);
}

export function createOutbox({ storage, send, now = () => new Date(), newId = () => crypto.randomUUID() }: Deps) {
  const listeners = new Set<() => void>();
  let state: OutboxState = { ...load(), syncedCount: 0, needsSignIn: false, flushing: false };

  function load(): Pick<OutboxState, "pending" | "rejected"> {
    try {
      const parsed = JSON.parse(storage?.getItem(KEY) ?? "null") as Pick<OutboxState, "pending" | "rejected"> | null;
      return { pending: parsed?.pending ?? [], rejected: parsed?.rejected ?? [] };
    } catch {
      return { pending: [], rejected: [] };
    }
  }

  function set(next: Partial<OutboxState>) {
    state = { ...state, ...next };
    try {
      storage?.setItem(KEY, JSON.stringify({ pending: state.pending, rejected: state.rejected }));
    } catch {
      // Full or blocked storage: the queue keeps working in memory for this session.
    }
    listeners.forEach((listener) => listener());
  }

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Sends the change now; when the connection fails it is queued instead. Anything else the server says is thrown. */
    async submit<T>(matchId: string, path: string, payload: Record<string, unknown>, online: boolean): Promise<{ queued: false; result: T } | { queued: true }> {
      const occurredAt = now().toISOString();
      // Something is already waiting: send this one behind it so changes of the same player keep their order.
      if (online && state.pending.length === 0) {
        try {
          return { queued: false, result: (await send(path, { ...payload, occurredAt })) as T };
        } catch (error) {
          if (!isConnectionError(error)) throw error;
        }
      }
      set({ pending: [...state.pending, { id: newId(), matchId, path, payload, occurredAt }] });
      return { queued: true };
    },

    /** Replays the queue in order. Stops at the first connection failure or when the session expired. */
    async flush(): Promise<void> {
      if (state.flushing || state.pending.length === 0) return;
      set({ flushing: true, needsSignIn: false });
      let synced = 0;
      try {
        while (state.pending.length > 0) {
          const [op, ...rest] = state.pending;
          try {
            await send(op.path, { ...op.payload, occurredAt: op.occurredAt });
            synced += 1;
            set({ pending: rest });
          } catch (error) {
            if (isConnectionError(error)) break;
            if (error instanceof HttpError && error.status === 401) {
              set({ needsSignIn: true });
              break;
            }
            set({ pending: rest, rejected: [...state.rejected, { op, message: error instanceof Error ? error.message : "No se pudo aplicar el cambio" }] });
          }
        }
      } finally {
        set({ flushing: false, ...(synced > 0 ? { syncedCount: state.syncedCount + synced } : {}) });
      }
    },

    dismissRejected() {
      set({ rejected: [] });
    },
  };
}
