import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const IST = "Asia/Kolkata";

export function fmtDate(ms: number, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, ...opts }).format(ms);
}

export function fmtTime(ms: number) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true }).format(ms);
}

export function fmtDateTime(ms: number) {
  return `${fmtDate(ms, { day: "numeric", month: "short", year: "numeric" })}, ${fmtTime(ms)}`;
}

export function fmtNumber(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function fmtPct(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function relTime(ms: number, now = Date.now()) {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  return fmtDate(ms, { day: "numeric", month: "short", year: "numeric" });
}

/** Start of the IST day containing `ms`, as epoch ms. */
export function istDayStart(ms: number) {
  const offset = 5.5 * 3_600_000;
  return Math.floor((ms + offset) / 86_400_000) * 86_400_000 - offset;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function minutesToLabel(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${suffix}`;
}
