import { describe, it, expect } from "vitest";
import { defaultCutoff } from "./weeks";

describe("defaultCutoff", () => {
  it("uses the current day and time-of-day slot within the week", () => {
    // Week starts Mon 2026-07-13; Wed 2026-07-15 at 15:00 → day 2, afternoon_snack.
    const cutoff = defaultCutoff(new Date(2026, 6, 15, 15, 0), "2026-07-13");
    expect(cutoff).toEqual({ day: 2, slot: "afternoon_snack" });
  });

  it("maps early-morning to breakfast on the current day", () => {
    // Thu 2026-07-16 at 07:30 → day 3, breakfast (nothing eaten yet today).
    const cutoff = defaultCutoff(new Date(2026, 6, 16, 7, 30), "2026-07-13");
    expect(cutoff).toEqual({ day: 3, slot: "breakfast" });
  });

  it("treats a date before the week as fully adjustable", () => {
    const cutoff = defaultCutoff(new Date(2026, 6, 10, 12, 0), "2026-07-13");
    expect(cutoff).toEqual({ day: 0, slot: "breakfast" });
  });

  it("clamps a date past the week to the last day", () => {
    const cutoff = defaultCutoff(new Date(2026, 6, 25, 20, 0), "2026-07-13");
    expect(cutoff).toEqual({ day: 6, slot: "dinner" });
  });
});
