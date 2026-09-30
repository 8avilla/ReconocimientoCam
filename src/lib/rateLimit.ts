/**
 * Failed-attempt limiter for password sign-in, per key (the email). In memory: it resets when the server restarts
 * and is not shared between instances, which is enough to make guessing a password impractical on one server.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, number[]>();

const recent = (key: string) => (failures.get(key) ?? []).filter((at) => Date.now() - at < WINDOW_MS);

export function isRateLimited(key: string): boolean {
  return recent(key).length >= MAX_FAILURES;
}

export function recordFailure(key: string): void {
  failures.set(key, [...recent(key), Date.now()]);
}

export function clearFailures(key: string): void {
  failures.delete(key);
}
