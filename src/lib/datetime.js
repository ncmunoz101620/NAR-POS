// The server stores created_date/updated_date as UTC but WITHOUT a timezone
// suffix (e.g. "2026-08-26T06:33:43.993000"). Browsers parse such naive strings
// as local time, which shifts the value by the user's offset. Normalize by
// appending "Z" so the value is treated as UTC, then format in Asia/Manila.

const TZ = "Asia/Manila";

export function toManilaDate(value) {
  if (!value) return new Date(NaN);
  const str = String(value);
  const hasTz = /z$|z$|[+-]\d{2}:?\d{2}$/i.test(str);
  return new Date(hasTz ? str : str + "Z");
}

export function formatManila(value, options = {}) {
  const d = toManilaDate(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
    ...options,
  });
}

export function formatManilaDate(value) {
  const d = toManilaDate(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { timeZone: TZ });
}

// Manila calendar day as YYYY-MM-DD (e.g. "2026-09-06"). Use this for date-range
// filtering so it matches what staff see on the Orders page regardless of the
// server's timezone-less UTC timestamps.
export function manilaDateString(value) {
  const d = toManilaDate(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}