import { describe, expect, test } from "vitest";
import { parseOnHand } from "../../src/lib/onHand";

describe("parseOnHand", () => {
  test("splits on newlines", () => {
    expect(parseOnHand("leek\nkale\ncarrots")).toEqual([
      "leek",
      "kale",
      "carrots",
    ]);
  });

  test("splits on commas", () => {
    expect(parseOnHand("leek, kale, carrots")).toEqual([
      "leek",
      "kale",
      "carrots",
    ]);
  });

  test("splits on a mix of newlines and commas", () => {
    expect(parseOnHand("half a cabbage, leftover rice\n2 carrots")).toEqual([
      "half a cabbage",
      "leftover rice",
      "2 carrots",
    ]);
  });

  test("trims whitespace and drops blank lines", () => {
    expect(parseOnHand("  leek  \n\n  ,  , kale \n")).toEqual(["leek", "kale"]);
  });

  test("dedupes case-insensitively, keeping the first spelling", () => {
    expect(parseOnHand("Leek\nleek, LEEK, Kale")).toEqual(["Leek", "Kale"]);
  });

  test("returns an empty array for blank input", () => {
    expect(parseOnHand("")).toEqual([]);
    expect(parseOnHand("   \n , \n ")).toEqual([]);
  });
});
