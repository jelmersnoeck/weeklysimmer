import { describe, it, expect } from "vitest";
import { toBaseUnit, dimensionOf, baseUnit } from "../../src/domain/units.js";

describe("units", () => {
  it("converts mass to grams", () => {
    expect(toBaseUnit(1, "kg")).toEqual({ value: 1000, dimension: "mass" });
    expect(toBaseUnit(200, "g")).toEqual({ value: 200, dimension: "mass" });
  });

  it("converts volume to millilitres", () => {
    expect(toBaseUnit(2, "l")).toEqual({ value: 2000, dimension: "volume" });
    expect(toBaseUnit(250, "ml")).toEqual({ value: 250, dimension: "volume" });
  });

  it("is case- and whitespace-insensitive", () => {
    expect(dimensionOf(" KG ")).toBe("mass");
    expect(dimensionOf("Litres")).toBe("volume");
  });

  it("returns null for non-convertible count units", () => {
    expect(toBaseUnit(3, "clove")).toBeNull();
    expect(dimensionOf("piece")).toBeNull();
  });

  it("exposes base unit symbols", () => {
    expect(baseUnit("mass")).toBe("g");
    expect(baseUnit("volume")).toBe("ml");
  });
});
