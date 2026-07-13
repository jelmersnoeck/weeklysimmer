import type { ShoppingItem } from "../domain/types.js";
import { consolidateShoppingList } from "../domain/shopping.js";
import type { PlanCurator } from "./anthropicClient.js";
import { log, logError } from "../log.js";

/**
 * Orchestrate the LLM shopping-list CONSOLIDATION REVIEW with a safe fallback.
 *
 * The LLM ONLY names each item's canonical grocery product; deterministic code
 * (consolidateShoppingList) does every quantity merge. This never breaks generation:
 *   - With <= 1 item there is nothing to consolidate, so we skip the LLM call entirely.
 *   - Any error from the LLM call is logged and the ORIGINAL, un-consolidated list is
 *     returned unchanged — we never throw.
 */
export async function consolidateShopping(
  curator: PlanCurator,
  items: ShoppingItem[],
): Promise<ShoppingItem[]> {
  if (items.length <= 1) return items;

  log("consolidate", `reviewing ${items.length} items…`);
  try {
    const mapping = await curator.consolidateShopping(items.map((i) => i.name));
    const result = consolidateShoppingList(items, mapping);
    log("consolidate", `${items.length} → ${result.length} items`);
    return result;
  } catch (err) {
    logError(
      "consolidate",
      `review failed — keeping the un-consolidated ${items.length}-item list`,
      err,
    );
    return items;
  }
}
