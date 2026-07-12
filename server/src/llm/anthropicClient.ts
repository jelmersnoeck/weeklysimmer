import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Settings, Meal, Slot } from "../domain/types.js";
import { buildCurationPrompt, buildRegeneratePrompt } from "./prompt.js";
import { planSchema, rawMealSchema, type RawPlan, type RawMeal } from "./planSchema.js";

export interface CuratorInput {
  settings: Settings;
  weekStart: string;
  vegBox: string[];
  note: string;
  avoid: string[];
}

export interface RegenerateMealInput {
  settings: Settings;
  day: number;
  slot: Slot;
  vegBox: string[];
  note: string;
  otherMeals: Meal[];
}

/** Port: the app depends on this, not on the SDK directly. */
export interface PlanCurator {
  curate(input: CuratorInput): Promise<RawPlan>;
  /** Produce a single replacement meal for one slot in an existing plan. */
  regenerateMeal(input: RegenerateMealInput): Promise<RawMeal>;
}

/**
 * Minimal shape of the Anthropic client the wrapper actually uses. Narrow on
 * purpose so a fake can satisfy it in tests without a network call. We only call
 * `messages.parse` and only read `parsed_output` off the result.
 */
export interface MinimalAnthropicClient {
  messages: {
    parse(params: Record<string, unknown>): Promise<{ parsed_output?: unknown }>;
  };
}

const MODEL = "claude-opus-4-8";
// A 21-meal plan is large; give the model plenty of room. The TS SDK auto-extends
// the HTTP timeout for large max_tokens on non-streaming requests.
const MAX_TOKENS = 32000;

/**
 * Adapter: wraps a (real or fake) Anthropic client behind the PlanCurator port.
 *
 * `curate` builds the prompt, calls the model with the web_search server tool and
 * schema-constrained structured output, then re-validates the returned data with
 * `planSchema.parse` and returns the typed plan. Throws a clear Error on invalid data.
 */
export function createAnthropicCurator(client: MinimalAnthropicClient): PlanCurator {
  return {
    async curate(input: CuratorInput): Promise<RawPlan> {
      const prompt = buildCurationPrompt(input);

      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        // web_search has code execution built in — do NOT also declare code_execution.
        tools: [{ type: "web_search_20260209", name: "web_search" }],
        output_config: { format: zodOutputFormat(planSchema) },
        messages: [{ role: "user", content: prompt }],
      });

      const parsed = response.parsed_output;
      if (parsed == null) {
        throw new Error("LLM curation returned no structured output (parsed_output was empty)");
      }

      const result = planSchema.safeParse(parsed);
      if (!result.success) {
        throw new Error(`LLM curation returned an invalid plan: ${result.error.message}`);
      }
      return result.data;
    },

    async regenerateMeal(input: RegenerateMealInput): Promise<RawMeal> {
      const prompt = buildRegeneratePrompt(input);

      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "adaptive" },
        tools: [{ type: "web_search_20260209", name: "web_search" }],
        output_config: { format: zodOutputFormat(rawMealSchema) },
        messages: [{ role: "user", content: prompt }],
      });

      const parsed = response.parsed_output;
      if (parsed == null) {
        throw new Error(
          "LLM regeneration returned no structured output (parsed_output was empty)"
        );
      }

      const result = rawMealSchema.safeParse(parsed);
      if (!result.success) {
        throw new Error(`LLM regeneration returned an invalid meal: ${result.error.message}`);
      }
      return result.data;
    },
  };
}

/**
 * Construct the real Anthropic client (reading ANTHROPIC_API_KEY from the env).
 * Not exercised in tests — tests inject a fake MinimalAnthropicClient.
 */
export function makeAnthropicClient(): MinimalAnthropicClient {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) as unknown as MinimalAnthropicClient;
}
