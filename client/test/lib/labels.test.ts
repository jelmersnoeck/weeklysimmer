import { describe, expect, test } from "vitest";
import { labelize } from "../../src/lib/labels";

describe("labelize", () => {
  test("title-cases a plain snake_case key", () => {
    expect(labelize("chicken")).toBe("Chicken");
    expect(labelize("morning_snack")).toBe("Morning snack");
  });

  test("applies special cases", () => {
    expect(labelize("white_fish")).toBe("White fish");
    expect(labelize("beans_legumes")).toBe("Beans & legumes");
    expect(labelize("halloumi_paneer")).toBe("Halloumi / paneer");
    expect(labelize("low_fodmap")).toBe("Low-FODMAP");
    expect(labelize("gluten_free")).toBe("Gluten-free");
    expect(labelize("dairy_free")).toBe("Dairy-free");
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
