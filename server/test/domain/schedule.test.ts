import { describe, it, expect } from "vitest";
import {
  SLOTS,
  defaultMealSchedule,
  enabledSlotsFromSchedule,
} from "../../src/domain/schedule.js";

describe("defaultMealSchedule", () => {
  it("enables all 35 cells (5 slots x 7 days)", () => {
    const schedule = defaultMealSchedule();
    expect(Object.keys(schedule)).toHaveLength(5);
    for (const slot of SLOTS) {
      expect(schedule[slot]).toEqual([true, true, true, true, true, true, true]);
    }
  });

  it("returns independent arrays per slot (mutating one does not affect others)", () => {
    const schedule = defaultMealSchedule();
    schedule.breakfast[0] = false;
    expect(schedule.dinner[0]).toBe(true);
  });
});

describe("enabledSlotsFromSchedule", () => {
  it("flattens the full default schedule to 35 day-major cells", () => {
    const enabled = enabledSlotsFromSchedule(defaultMealSchedule());
    expect(enabled).toHaveLength(35);
    // day-major, slots in display order: first cell is Monday breakfast
    expect(enabled[0]).toEqual({ day: 0, slot: "breakfast" });
    expect(enabled[4]).toEqual({ day: 0, slot: "dinner" });
    expect(enabled[5]).toEqual({ day: 1, slot: "breakfast" });
  });

  it("excludes disabled cells", () => {
    const schedule = defaultMealSchedule();
    schedule.breakfast[0] = false; // Monday breakfast off
    schedule.dinner[6] = false; // Sunday dinner off
    const enabled = enabledSlotsFromSchedule(schedule);
    expect(enabled).toHaveLength(33);
    expect(enabled).not.toContainEqual({ day: 0, slot: "breakfast" });
    expect(enabled).not.toContainEqual({ day: 6, slot: "dinner" });
    expect(enabled).toContainEqual({ day: 0, slot: "lunch" });
  });

  it("returns no cells when every slot is disabled", () => {
    const schedule = defaultMealSchedule();
    for (const slot of SLOTS) schedule[slot] = Array(7).fill(false);
    expect(enabledSlotsFromSchedule(schedule)).toEqual([]);
  });
});
