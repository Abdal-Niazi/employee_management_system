const pad = (n) => String(n).padStart(2, "0");

// Local calendar day as YYYY-MM-DD.
export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toDateKey(new Date());
}

export function addDays(key, days) {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function isWeekend(key) {
  const day = fromDateKey(key).getDay();
  return day === 0 || day === 6;
}

export function formatDay(key) {
  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function relativeDayLabel(key) {
  const today = todayKey();
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  return formatDay(key);
}

export function formatRange(startKey, endKey) {
  return startKey === endKey ? formatDay(startKey) : `${formatDay(startKey)} – ${formatDay(endKey)}`;
}

// Backend DateTimes (e.g. hireDate) are stored at UTC midnight.
export function formatIsoDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Counts calendar days, so something from yesterday evening is "yesterday", not "today".
export function timeAgo(iso) {
  const then = fromDateKey(toDateKey(new Date(iso)));
  const today = fromDateKey(todayKey());
  const days = Math.round((today - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
