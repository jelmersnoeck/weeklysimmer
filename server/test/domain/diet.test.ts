import { describe, it, expect } from "vitest";
import { dietConflicts } from "../../src/domain/diet.js";
import { makeSettings } from "../helpers/settings.js";
import type { Frequency } from "../../src/domain/types.js";

const proteins = (sel: Record<string, Frequency>) =>
  Object.entries(sel).map(([key, frequency]) => ({ key, frequency }));

describe("dietConflicts", () => {
  it("returns no conflicts when no diet framework is selected", () => {
    const s = makeSettings({
      diets: [],
      proteins: proteins({ chicken: "often", beef: "weekly" }),
      flavoursLiked: ["cheesy", "garlicky", "creamy"],
      dishTypesLiked: ["pasta", "wraps_tacos"],
    });
    expect(dietConflicts(s)).toEqual([]);
  });

  it("only treats proteins with frequency !== never as selected", () => {
    const s = makeSettings({
      diets: ["vegetarian"],
      proteins: proteins({ chicken: "never", tofu: "weekly" }),
    });
    expect(dietConflicts(s)).toEqual([]);
  });

  describe("vegetarian", () => {
    it("flags selected meat/fish proteins", () => {
      const s = makeSettings({
        diets: ["vegetarian"],
        proteins: proteins({ chicken: "often", tofu: "weekly", salmon: "never" }),
      });
      const c = dietConflicts(s);
      expect(c).toHaveLength(1);
      expect(c[0].field).toBe("proteins");
      expect(c[0].key).toBe("chicken");
      expect(c[0].message.toLowerCase()).toContain("isn't vegetarian");
    });
  });

  describe("vegan", () => {
    it("flags meat, eggs, halloumi/paneer and liked cheese", () => {
      const s = makeSettings({
        diets: ["vegan"],
        proteins: proteins({
          chicken: "weekly",
          eggs: "weekly",
          halloumi_paneer: "occasionally",
          tofu: "often",
        }),
        flavoursLiked: ["cheesy", "savoury"],
      });
      const c = dietConflicts(s);
      const keys = c.map((x) => x.key).sort();
      expect(keys).toEqual(["cheesy", "chicken", "eggs", "halloumi_paneer"]);
      const cheese = c.find((x) => x.key === "cheesy")!;
      expect(cheese.field).toBe("flavours");
      expect(cheese.message.toLowerCase()).toContain("cheese isn't vegan");
      expect(c.find((x) => x.key === "eggs")!.message.toLowerCase()).toContain(
        "isn't vegan",
      );
    });
  });

  describe("pescatarian", () => {
    it("flags meat but allows fish and shellfish", () => {
      const s = makeSettings({
        diets: ["pescatarian"],
        proteins: proteins({
          chicken: "often",
          beef: "occasionally",
          salmon: "weekly",
          shellfish: "weekly",
        }),
      });
      const c = dietConflicts(s);
      const keys = c.map((x) => x.key).sort();
      expect(keys).toEqual(["beef", "chicken"]);
      expect(c[0].message.toLowerCase()).toContain("isn't pescatarian");
    });
  });

  describe("low_fodmap", () => {
    it("flags beans and liked garlic", () => {
      const s = makeSettings({
        diets: ["low_fodmap"],
        proteins: proteins({ beans_legumes: "weekly", chicken: "often" }),
        flavoursLiked: ["garlicky", "savoury"],
      });
      const c = dietConflicts(s);
      const beans = c.find((x) => x.key === "beans_legumes")!;
      expect(beans.field).toBe("proteins");
      expect(beans.message.toLowerCase()).toContain("beans are high-fodmap");
      const garlic = c.find((x) => x.key === "garlicky")!;
      expect(garlic.field).toBe("flavours");
      expect(garlic.message.toLowerCase()).toContain("garlic is high-fodmap");
      // chicken is fine on low-fodmap
      expect(c.find((x) => x.key === "chicken")).toBeUndefined();
    });
  });

  describe("multiple diets", () => {
    it("unions conflicts across every selected diet", () => {
      const s = makeSettings({
        diets: ["vegan", "low_fodmap"],
        proteins: proteins({ chicken: "often", beans_legumes: "weekly", tofu: "often" }),
        flavoursLiked: ["garlicky", "savoury"],
      });
      const c = dietConflicts(s);
      const keys = c.map((x) => x.key).sort();
      // chicken from vegan; beans_legumes + garlicky from low_fodmap
      expect(keys).toEqual(["beans_legumes", "chicken", "garlicky"]);
    });

    it("dedupes a key flagged by more than one diet", () => {
      const s = makeSettings({
        diets: ["vegetarian", "vegan"],
        proteins: proteins({ chicken: "often" }),
      });
      const c = dietConflicts(s);
      // both vegetarian and vegan flag chicken; only one entry survives
      expect(c.filter((x) => x.key === "chicken")).toHaveLength(1);
    });
  });
});
