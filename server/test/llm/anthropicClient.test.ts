import { describe, it, expect } from "vitest";
import {
  createAnthropicCurator,
  type MinimalAnthropicClient,
  type CuratorInput,
} from "../../src/llm/anthropicClient.js";
import type { RawPlan } from "../../src/llm/planSchema.js";
import type { Settings } from "../../src/domain/types.js";

const settings: Settings = {
  members: [{ label: "Adult", consumptionFactor: 1.15 }],
  restrictions: ["no_spicy"],
  avoidIngredients: ["beans"],
  proteinCadence: { veg_per_week: 1, red_or_high_fat_per_week: 1 },
  effort: "easy",
  defaultVegQuantities: {},
};

const input: CuratorInput = {
  settings,
  weekStart: "2026-07-13",
  vegBox: ["carrots"],
  note: "",
  avoid: [],
};

const validPlan: RawPlan = {
  meals: [
    {
      day: 0,
      slot: "dinner",
      title: "Lemon chicken with rice",
      cuisine: "mediterranean",
      proteinClass: "lean",
      base: "rice",
      difficulty: "easy",
      ingredients: [{ name: "chicken breast", quantity: 150, unit: "g", category: "meat" }],
      steps: ["Cook."],
      sourceUrl: "https://example.com/r",
      leftoverOf: null,
    },
  ],
};

/** Records the params it was called with and returns a canned parsed_output. */
function fakeClient(parsed: unknown): {
  client: MinimalAnthropicClient;
  calls: Array<Record<string, unknown>>;
} {
  const calls: Array<Record<string, unknown>> = [];
  const client: MinimalAnthropicClient = {
    messages: {
      async parse(params) {
        calls.push(params as Record<string, unknown>);
        return { parsed_output: parsed };
      },
    },
  };
  return { client, calls };
}

describe("createAnthropicCurator", () => {
  it("returns a typed plan and calls the client correctly", async () => {
    const { client, calls } = fakeClient(validPlan);
    const curator = createAnthropicCurator(client);

    const result = await curator.curate(input);

    expect(result).toEqual(validPlan);
    expect(calls).toHaveLength(1);

    const params = calls[0];
    expect(params.model).toBe("claude-opus-4-8");
    // web_search server tool was requested
    const tools = params.tools as Array<{ type: string; name: string }>;
    expect(tools.some((t) => t.name === "web_search")).toBe(true);
    expect(tools.some((t) => t.type === "web_search_20260209")).toBe(true);
    // adaptive thinking, not budget_tokens
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(JSON.stringify(params.thinking)).not.toContain("budget_tokens");
    // structured output constrained via output_config.format
    expect(params.output_config).toBeTruthy();
    // prompt was built and passed as the user message
    const messages = params.messages as Array<{ role: string; content: string }>;
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("carrots");
  });

  it("throws when the structured output is invalid", async () => {
    const invalid = {
      meals: [{ ...validPlan.meals[0], proteinClass: "not-a-class" }],
    };
    const { client } = fakeClient(invalid);
    const curator = createAnthropicCurator(client);

    await expect(curator.curate(input)).rejects.toThrow();
  });

  it("throws when parsed_output is missing entirely", async () => {
    const { client } = fakeClient(null);
    const curator = createAnthropicCurator(client);

    await expect(curator.curate(input)).rejects.toThrow();
  });
});
