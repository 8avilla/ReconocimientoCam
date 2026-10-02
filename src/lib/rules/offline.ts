/** An offline device may be synced days later, never from the future: outside this window the server's clock wins. */
const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
/** Below this the change is treated as made online (ordinary request latency, not a queue). */
const LIVE_THRESHOLD_MS = 1000;

/** The time to record: the device's, when it is plausible, otherwise now. `offline` tells the caller it came from a queue. */
export function resolveOccurredAt(occurredAt: Date | undefined, now = new Date()): { at: Date; offline: boolean } {
  if (!occurredAt || Number.isNaN(occurredAt.getTime())) return { at: now, offline: false };
  const age = now.getTime() - occurredAt.getTime();
  if (age < -CLOCK_SKEW_MS || age > OFFLINE_MAX_AGE_MS) return { at: now, offline: false };
  return { at: occurredAt.getTime() > now.getTime() ? now : occurredAt, offline: age > LIVE_THRESHOLD_MS };
}

/** A change made offline loses against a newer one already recorded (somebody else marked it meanwhile). */
export function isStale(current: Date | undefined, at: Date, offline: boolean): boolean {
  return offline && current !== undefined && current.getTime() > at.getTime();
}
