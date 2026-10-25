const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseToUtcDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) return dateInput;
  if (!dateInput) return new Date(NaN);
  
  const str = String(dateInput).trim();
  // If string has no timezone indicator, append Z to enforce UTC
  const normalized =
    !str.endsWith("Z") && !/[+-]\d{2}(:\d{2})?$/.test(str)
      ? `${str}Z`
      : str;
  return new Date(normalized);
}

/**
 * Format a UTC timestamp as "HH:00" (e.g. "00:00", "01:00", ... "23:00")
 * strictly in UTC without local browser timezone conversion.
 */
export function formatUtcHour(dateInput: string | Date): string {
  const d = parseToUtcDate(dateInput);
  if (isNaN(d.getTime())) return "--:00";
  const hours = String(d.getUTCHours()).padStart(2, "0");
  return `${hours}:00`;
}

/**
 * Format a UTC timestamp as "d MMM" (e.g. "15 Jan")
 * strictly in UTC without local browser timezone conversion.
 */
export function formatUtcDate(dateInput: string | Date): string {
  const d = parseToUtcDate(dateInput);
  if (isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * Format a UTC timestamp as "d MMM HH:00" (e.g. "15 Jan 00:00")
 * strictly in UTC without local browser timezone conversion.
 */
export function formatUtcDateTime(dateInput: string | Date): string {
  const d = parseToUtcDate(dateInput);
  if (isNaN(d.getTime())) return "";
  const hours = String(d.getUTCHours()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${hours}:00`;
}

/**
 * Format a UTC publish timestamp as "d MMM, HH:mm 'UTC'" (e.g. "14 Jan, 08:45 UTC")
 * strictly in UTC without local browser timezone conversion.
 */
export function formatUtcPublishTime(dateInput: string | Date): string {
  const d = parseToUtcDate(dateInput);
  if (isNaN(d.getTime())) return "";
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const mins = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hours}:${mins} UTC`;
}
