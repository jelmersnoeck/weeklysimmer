import { describe, expect, test } from "vitest";
import { comingMonday, toISODate, upcomingWeekOptions } from "../../src/lib/weeks";

// Construct dates from local components (new Date(y, m, d)) so the tests are
// timezone-independent. July 2026: 12th is Sunday, 13th Monday, 18th Saturday.

describe("comingMonday", () => {
  test("planning on Sunday targets the next day's Monday (next week)", () => {
    expect(toISODate(comingMonday(new Date(2026, 6, 12)))).toBe("2026-07-13");
  });

  test("planning on Saturday targets the coming Monday (next week)", () => {
    expect(toISODate(comingMonday(new Date(2026, 6, 18)))).toBe("2026-07-20");
  });

  test("planning midweek targets the next Monday, never a past one", () => {
    // Wed 15 Jul 2026 -> next Monday is 20 Jul (not the 13th, which is behind us)
    expect(toISODate(comingMonday(new Date(2026, 6, 15)))).toBe("2026-07-20");
  });

  test("planning on Monday itself targets that same Monday (this week)", () => {
    expect(toISODate(comingMonday(new Date(2026, 6, 13)))).toBe("2026-07-13");
  });
});

describe("upcomingWeekOptions", () => {
  test("returns consecutive Mondays starting at the coming Monday", () => {
    const opts = upcomingWeekOptions(new Date(2026, 6, 12), 4);
    expect(opts.map((o) => o.weekStart)).toEqual([
      "2026-07-13",
      "2026-07-20",
      "2026-07-27",
      "2026-08-03",
    ]);
  });

  test("labels describe the Monday–Sunday span", () => {
    const [first] = upcomingWeekOptions(new Date(2026, 6, 12), 1);
    expect(first.label).toContain("13");
    expect(first.label).toContain("19"); // Sunday of that week
  });
});
