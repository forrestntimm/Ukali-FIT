export const APP_TIME_ZONE = "Asia/Kathmandu";
const APP_LOCALE = "en-NP";

type DateInput = string | number | Date;

function toDate(value: DateInput) {
  return value instanceof Date ? value : new Date(value);
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

export function toDayKeyInAppTimeZone(value: DateInput) {
  const date = toDate(value);
  if (!isValidDate(date)) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function stableDateFromDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const stableDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return isValidDate(stableDate) ? stableDate : null;
}

export function formatDayLabelInAppTimeZone(dayKey: string) {
  const date = stableDateFromDayKey(dayKey);
  if (!date) {
    return dayKey || "Unknown day";
  }

  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
}

export function formatDateInAppTimeZone(value: DateInput) {
  const date = toDate(value);
  if (!isValidDate(date)) {
    return typeof value === "string" && value.trim().length > 0 ? value : "Unknown date";
  }

  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function formatDateTimeInAppTimeZone(value: DateInput) {
  const date = toDate(value);
  if (!isValidDate(date)) {
    return typeof value === "string" && value.trim().length > 0 ? value : "Unknown time";
  }

  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}
