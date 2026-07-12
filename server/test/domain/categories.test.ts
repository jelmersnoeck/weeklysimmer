import { describe, it, expect } from "vitest";
import { canonicalCategory } from "../../src/domain/categories.js";

describe("canonicalCategory", () => {
  it("reclassifies dry starches to bulk_staples", () => {
    expect(canonicalCategory("basmati rice", "grains")).toBe("bulk_staples");
    expect(canonicalCategory("penne pasta", "grains")).toBe("bulk_staples");
    expect(canonicalCategory("spaghetti", "grains")).toBe("bulk_staples");
    expect(canonicalCategory("egg noodles", "grains")).toBe("bulk_staples");
    expect(canonicalCategory("rolled oats", "grains")).toBe("bulk_staples");
    expect(canonicalCategory("plain flour", "pantry")).toBe("bulk_staples");
    expect(canonicalCategory("couscous", "grains")).toBe("bulk_staples");
    expect(canonicalCategory("quinoa", "grains")).toBe("bulk_staples");
    expect(canonicalCategory("red lentils", "pantry")).toBe("bulk_staples");
  });

  it("reclassifies canned / shelf-stable goods to bulk_staples", () => {
    expect(canonicalCategory("canned tuna", "fish")).toBe("bulk_staples");
    expect(canonicalCategory("tinned tomatoes", "pantry")).toBe("bulk_staples");
    expect(canonicalCategory("coconut milk", "pantry")).toBe("bulk_staples");
    expect(canonicalCategory("passata", "pantry")).toBe("bulk_staples");
    expect(canonicalCategory("chicken stock cube", "pantry")).toBe("bulk_staples");
    expect(canonicalCategory("bouillon powder", "pantry")).toBe("bulk_staples");
  });

  it("reclassifies butter and breadcrumbs (bought in bulk, reused across weeks)", () => {
    expect(canonicalCategory("butter", "dairy")).toBe("bulk_staples");
    expect(canonicalCategory("unsalted butter", "dairy")).toBe("bulk_staples");
    expect(canonicalCategory("breadcrumbs", "pantry")).toBe("bulk_staples");
    expect(canonicalCategory("dried bread crumbs", "pantry")).toBe("bulk_staples");
    expect(canonicalCategory("panko", "pantry")).toBe("bulk_staples");
  });

  it("is case-insensitive on the name", () => {
    expect(canonicalCategory("Basmati Rice", "grains")).toBe("bulk_staples");
    expect(canonicalCategory("CANNED CHICKPEAS", "pantry")).toBe("bulk_staples");
  });

  it("keeps every rice variant in bulk_staples via the 'rice' substring", () => {
    expect(canonicalCategory("cooked rice", "grains")).toBe("bulk_staples");
    expect(canonicalCategory("jasmine rice", "grains")).toBe("bulk_staples");
  });

  it("leaves perishable ingredients' categories unchanged", () => {
    expect(canonicalCategory("chicken breast", "meat")).toBe("meat");
    expect(canonicalCategory("olive oil", "pantry")).toBe("pantry");
    expect(canonicalCategory("carrots", "produce")).toBe("produce");
    expect(canonicalCategory("greek yogurt", "dairy")).toBe("dairy");
  });
});
