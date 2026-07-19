// Week-start helpers. Weeks are canonically Monday-started; the planner only ever
// deals in Monday dates, so we snap here at the input boundary rather than accept
// arbitrary dates and reason about partial weeks downstream.

import type { Slot } from "../types";

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

/**
 * Where to draw the "already eaten vs still-to-come" line for a mid-week adjustment,
 * inferred from the current date+time relative to the week's Monday. Everything BEFORE
 * the returned (day, slot) is frozen; that cell and later are still adjustable.
 *
 * - Day index = whole days from `weekStart` (Monday) to `today`, clamped to 0–6.
 *   Planning before the week even starts → the whole week is adjustable ({0,breakfast}).
 * - Slot by local hour of day (documented defaults, easy to tune): a slot counts as
 *   "still to come" from these times — <9 breakfast, <11 morning_snack, <14 lunch,
 *   <17 afternoon_snack, otherwise dinner.
 */
export function defaultCutoff(
  today: Date,
  weekStart: string,
): { day: number; slot: Slot } {
  const monday = new Date(`${weekStart}T00:00:00`);
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayDiff = Math.floor((now.getTime() - start.getTime()) / 86_400_000);

  if (dayDiff < 0) return { day: 0, slot: "breakfast" };
  const day = Math.min(6, dayDiff);

  const hour = today.getHours();
  const slot: Slot =
    hour < 9
      ? "breakfast"
      : hour < 11
        ? "morning_snack"
        : hour < 14
          ? "lunch"
          : hour < 17
            ? "afternoon_snack"
            : "dinner";

  return { day, slot };
}
