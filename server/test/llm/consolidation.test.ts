import { describe, it, expect } from "vitest";
import { consolidateShopping } from "../../src/llm/consolidation.js";
import type { PlanCurator } from "../../src/llm/anthropicClient.js";
import type { ShoppingItem } from "../../src/domain/types.js";

/** ShoppingItem factory. */
function item(overrides: Partial<ShoppingItem> & { name: string }): ShoppingItem {
  return {
    totalQuantity: 100,
    unit: "g",
    category: "bulk_staples",
    checked: false,
    ...overrides,
  };
}

/** A curator that only implements consolidateShopping via `fn`; other methods throw. */
function curatorWith(
  fn: (names: string[]) => Promise<Array<{ name: string; canonical: string }>>,
): { curator: PlanCurator; calls: string[][] } {
  const calls: string[][] = [];
  const curator: PlanCurator = {
    async curate() {
      throw new Error("not used");
    },
    async regenerateMeal() {
      throw new Error("not used");
    },
    async consolidateShopping(names) {
      calls.push(names);
      return fn(names);
    },
  };
  return { curator, calls };
}

describe("consolidateShopping (orchestration)", () => {
  it("skips the LLM call and returns items unchanged for a single item", async () => {
    const { curator, calls } = curatorWith(async (n) =>
      n.map((x) => ({ name: x, canonical: x })),
    );
    const items = [item({ name: "rice", totalQuantity: 300 })];
    const result = await consolidateShopping(curator, items);
    expect(result).toBe(items);
    expect(calls).toHaveLength(0);
  });

  it("skips the LLM call for an empty list", async () => {
    const { curator, calls } = curatorWith(async (n) =>
      n.map((x) => ({ name: x, canonical: x })),
    );
    const result = await consolidateShopping(curator, []);
    expect(result).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("consolidates by the LLM-provided mapping and re-merges quantities", async () => {
    const { curator, calls } = curatorWith(async (names) =>
      names.map((n) => ({
        name: n,
        canonical: n.includes("rice") && n !== "brown rice" ? "rice" : n,
      })),
    );
    const items = [
      item({ name: "cooked rice", totalQuantity: 450 }),
      item({ name: "jasmine rice", totalQuantity: 900 }),
      item({ name: "brown rice", totalQuantity: 200 }),
    ];
    const result = await consolidateShopping(curator, items);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["cooked rice", "jasmine rice", "brown rice"]);
    expect(result).toHaveLength(2);
    expect(result.find((i) => i.name === "rice")!.totalQuantity).toBe(1350);
    expect(result.find((i) => i.name === "brown rice")!.totalQuantity).toBe(200);
  });

  it("falls back to the original items when the LLM call throws", async () => {
    const { curator } = curatorWith(async () => {
      throw new Error("boom");
    });
    const items = [
      item({ name: "cooked rice", totalQuantity: 450 }),
      item({ name: "jasmine rice", totalQuantity: 900 }),
    ];
    const result = await consolidateShopping(curator, items);
    // never throws; returns the exact original list untouched
    expect(result).toBe(items);
  });
});
