import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type {
  Settings,
  Meal,
  Slot,
  ProteinClass,
  EnabledSlot,
} from "../domain/types.js";
import {
  buildCurationPrompt,
  buildRegeneratePrompt,
  buildConsolidationPrompt,
} from "./prompt.js";
import {
  planSchema,
  rawMealSchema,
  consolidationSchema,
  type RawPlan,
  type RawMeal,
} from "./planSchema.js";

export interface CuratorInput {
  settings: Settings;
  weekStart: string;
  onHand: string[];
  note: string;
  avoid: string[];
  enabledSlots: EnabledSlot[];
}

export interface RegenerateMealInput {
  settings: Settings;
  day: number;
  slot: Slot;
  proteinClass: ProteinClass;
  onHand: string[];
  note: string;
  otherMeals: Meal[];
}

/** Port: the app depends on this, not on the SDK directly. */
export interface PlanCurator {
  curate(input: CuratorInput): Promise<RawPlan>;
  /** Produce a single replacement meal for one slot in an existing plan. */
  regenerateMeal(input: RegenerateMealInput): Promise<RawMeal>;
  /**
   * Review a built shopping list: for each item name, return a canonical
   * grocery-product name so code can re-merge same-product lines. The LLM ONLY
   * names — all quantity arithmetic stays in deterministic code.
   */
  consolidateShopping(
    names: string[],
  ): Promise<Array<{ name: string; canonical: string }>>;
}

/**
 * Minimal shape of the Anthropic client the wrapper actually uses. Narrow on
 * purpose so a fake can satisfy it in tests without a network call. We stream the
 * request (required for large outputs — a 35-meal plan exceeds the SDK's
 * non-streaming size guard) and read `parsed_output` off the final message.
 */
export interface MinimalAnthropicClient {
  messages: {
    stream(params: Record<string, unknown>): {
      finalMessage(): Promise<{ parsed_output?: unknown }>;
    };
  };
}

const MODEL = "claude-opus-4-8";
// A 35-meal plan is a large output. We stream (see MinimalAnthropicClient) so the
// SDK doesn't reject the request under its 10-minute non-streaming ceiling.
const MAX_TOKENS = 32000;

/**
 * Call the model with the web_search server tool and schema-constrained structured
 * output, streaming the response, then re-validate the parsed result against `schema`
 * (defense in depth). Throws a clear, labelled Error on empty or invalid output.
 */
async function curateStructured<T>(
  client: MinimalAnthropicClient,
  schema: z.ZodType<T>,
  prompt: string,
  label: string,
): Promise<T> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    // web_search has code execution built in — do NOT also declare code_execution.
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    output_config: { format: zodOutputFormat(schema) },
    messages: [{ role: "user", content: prompt }],
  });

  const response = await stream.finalMessage();
  const parsed = response.parsed_output;
  if (parsed == null) {
    throw new Error(`LLM ${label} returned no structured output (parsed_output was empty)`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`LLM ${label} returned invalid data: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Adapter: wraps a (real or fake) Anthropic client behind the PlanCurator port.
 */
export function createAnthropicCurator(client: MinimalAnthropicClient): PlanCurator {
  return {
    curate(input: CuratorInput): Promise<RawPlan> {
      return curateStructured(client, planSchema, buildCurationPrompt(input), "curation");
    },
    regenerateMeal(input: RegenerateMealInput): Promise<RawMeal> {
      return curateStructured(client, rawMealSchema, buildRegeneratePrompt(input), "regeneration");
    },
    async consolidateShopping(
      names: string[],
    ): Promise<Array<{ name: string; canonical: string }>> {
      const result = await curateStructured(
        client,
        consolidationSchema,
        buildConsolidationPrompt(names),
        "consolidation",
      );
      return result.items;
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
