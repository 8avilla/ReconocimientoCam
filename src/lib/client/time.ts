/**
 * Moments that go into request addresses must be the same for every component that asks (and for a combined
 * request that asked in advance), or each would look like a different request.
 */

/** Start and end of today, already encoded for a query string. */
export function dayBounds(): { from: string; to: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { from: encodeURIComponent(start.toISOString()), to: encodeURIComponent(end.toISOString()) };
}
