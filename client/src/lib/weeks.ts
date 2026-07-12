// Week-start helpers. Weeks are canonically Monday-started; the planner only ever
// deals in Monday dates, so we snap here at the input boundary rather than accept
// arbitrary dates and reason about partial weeks downstream.

/** Local ISO date (YYYY-MM-DD) — timezone-safe (no UTC shift from toISOString). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * The upcoming Monday: today if today is Monday, otherwise the next Monday.
 *
 * So planning on the weekend (Sat/Sun) or midweek defaults to NEXT week's Monday,
 * while planning on Monday itself targets the week that just started.
 */
export function comingMonday(today: Date): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dow = (d.getDay() + 6) % 7; // 0 = Mon .. 6 = Sun
  const add = dow === 0 ? 0 : 7 - dow;
  d.setDate(d.getDate() + add);
  return d;
}

export interface WeekOption {
  weekStart: string; // ISO date of the Monday
  label: string; // e.g. "Mon 13 Jul – Sun 19 Jul"
}

function formatRange(monday: Date, sunday: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

/**
 * `count` consecutive Monday-started weeks, beginning at the coming Monday.
 * The first entry is the default the form should pre-select.
 */
export function upcomingWeekOptions(today: Date, count = 4): WeekOption[] {
  const start = comingMonday(today);
  const options: WeekOption[] = [];
  for (let i = 0; i < count; i++) {
    const monday = new Date(start);
    monday.setDate(start.getDate() + i * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    options.push({ weekStart: toISODate(monday), label: formatRange(monday, sunday) });
  }
  return options;
}
