/** Formats an ISO date for a `datetime-local` input (local time, minute precision). */
export function toDateTimeLocal(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Converts a `datetime-local` value (local time) to an ISO string. */
export const fromDateTimeLocal = (value: string): string => new Date(value).toISOString();
