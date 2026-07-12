import { describe, expect, test } from "vitest";
import { labelize } from "../../src/lib/labels";

describe("labelize", () => {
  test("title-cases a plain snake_case key", () => {
    expect(labelize("chicken")).toBe("Chicken");
    expect(labelize("morning_snack")).toBe("Morning snack");
  });

  test("avoid keys labelize sensibly via the default rule", () => {
    expect(labelize("lactose")).toBe("Lactose");
    expect(labelize("dairy")).toBe("Dairy");
    expect(labelize("gluten")).toBe("Gluten");
  });

  test("applies special cases", () => {
    expect(labelize("white_fish")).toBe("White fish");
    expect(labelize("beans_legumes")).toBe("Beans & legumes");
    expect(labelize("halloumi_paneer")).toBe("Halloumi / paneer");
    expect(labelize("low_fodmap")).toBe("Low-FODMAP");
    expect(labelize("metric")).toBe("Metric");
    expect(labelize("cups")).toBe("Cups");
    expect(labelize("child")).toBe("Child (3+)");
    expect(labelize("toddler")).toBe("Toddler (1–3)");
    expect(labelize("baby")).toBe("Baby (under 1)");
    expect(labelize("very_active")).toBe("Very active");
    expect(labelize("stir_fry")).toBe("Stir-fry");
    expect(labelize("tray_bake")).toBe("Tray-bake");
    expect(labelize("grain_bowl")).toBe("Grain bowl");
    expect(labelize("wraps_tacos")).toBe("Wraps & tacos");
    expect(labelize("middle_eastern")).toBe("Middle Eastern");
    expect(labelize("bell_pepper")).toBe("Bell pepper");
    expect(labelize("green_beans")).toBe("Green beans");
    expect(labelize("sweet_potato")).toBe("Sweet potato");
  });
});
