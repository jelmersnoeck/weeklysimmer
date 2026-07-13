import { useState } from "react";
import type { MeasurementSystem, ShoppingItem } from "../types";
import { formatQuantity } from "../lib/quantity";
import { copyText } from "../lib/clipboard";
import {
  remindersShortcutClipboardUrl,
  REMINDERS_SHORTCUT_NAME,
} from "../lib/reminders";
import "./ShoppingList.css";

interface ShoppingListProps {
  items: ShoppingItem[];
  units?: MeasurementSystem[];
  // Plan id, so the checked-off state can be remembered per plan across refreshes.
  planId?: number;
  // Foods the user said they already have; shown as a note (they're excluded from the list).
  onHand?: string[];
}

const SHORTCUT_NAME_KEY = "weeklysimmer:reminders-shortcut-name";

function storageKey(planId?: number): string | null {
  return planId == null ? null : `weeklysimmer:shopping:${planId}`;
}

function readChecked(planId?: number): Record<string, boolean> {
  const key = storageKey(planId);
  if (!key) return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function persistChecked(planId: number | undefined, checked: Record<string, boolean>): void {
  const key = storageKey(planId);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(checked));
  } catch {
    // Storage unavailable/full — checked state just won't survive a refresh.
  }
}

// Friendly, human-readable names for known shopping categories.
const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  meat: "Meat",
  dairy: "Dairy",
  fish: "Fish",
  bulk_staples: "Bulk staples",
  pantry: "Pantry",
  grains: "Grains",
};

// Title Case fallback for unknown categories: "baking_goods" → "Baking Goods".
function prettyCategory(category: string): string {
  const key = category.toLowerCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  return category
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function groupByCategory(items: ShoppingItem[]): [string, ShoppingItem[]][] {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const category = item.category || "Other";
    const bucket = groups.get(category);
    if (bucket) bucket.push(item);
    else groups.set(category, [item]);
  }
  // Keep existing (insertion) order, but push Bulk staples to its own section last.
  return Array.from(groups.entries()).sort(([a], [b]) => {
    const aBulk = a.toLowerCase() === "bulk_staples";
    const bBulk = b.toLowerCase() === "bulk_staples";
    return aBulk === bBulk ? 0 : aBulk ? 1 : -1;
  });
}

function itemQty(item: ShoppingItem, units: MeasurementSystem[]): string {
  return formatQuantity(
    {
      quantity: item.totalQuantity,
      unit: item.unit,
      cupQuantity: item.cupQuantity,
      cupUnit: item.cupUnit,
    },
    units,
  );
}

/**
 * Plain-text shopping list for pasting into another app — a FLAT list, one item
 * per line as "name (qty)" with no category headers (grocery apps categorize on
 * their own). Only the items NOT checked off are included (a checked item is one
 * you already have / don't need to buy). Returns "" when nothing remains.
 */
export function buildShoppingText(
  items: ShoppingItem[],
  checked: Record<string, boolean>,
  units: MeasurementSystem[],
): string {
  return items
    .filter((i) => !checked[i.name])
    .map((i) => `${i.name} (${itemQty(i, units)})`)
    .join("\n");
}

export function ShoppingList({
  items,
  units = ["metric"],
  planId,
  onHand = [],
}: ShoppingListProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    // Seed from the remembered per-plan state (localStorage), else the item defaults.
    const remembered = readChecked(planId);
    return Object.fromEntries(
      items.map((i) => [i.name, remembered[i.name] ?? i.checked]),
    );
  });
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed" | "empty">(
    "idle",
  );
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  // The user's Apple Shortcut name — editable, since it must match exactly. Remembered.
  const [shortcutName, setShortcutName] = useState<string>(() => {
    try {
      return window.localStorage.getItem(SHORTCUT_NAME_KEY) || REMINDERS_SHORTCUT_NAME;
    } catch {
      return REMINDERS_SHORTCUT_NAME;
    }
  });

  function updateShortcutName(name: string) {
    setShortcutName(name);
    try {
      window.localStorage.setItem(SHORTCUT_NAME_KEY, name);
    } catch {
      // storage unavailable — the name just won't persist across refreshes
    }
  }

  function toggle(name: string) {
    setChecked((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      persistChecked(planId, next);
      return next;
    });
    setCopyState("idle");
    setFallbackText(null);
  }

  async function handleCopy() {
    const text = buildShoppingText(items, checked, units);
    if (!text) {
      setCopyState("empty");
      return;
    }
    const ok = await copyText(text);
    if (ok) {
      setCopyState("copied");
      setFallbackText(null);
    } else {
      // Neither clipboard path worked — show the text so it can be selected by hand.
      setCopyState("failed");
      setFallbackText(text);
    }
  }

  async function handleReminders() {
    const text = buildShoppingText(items, checked, units);
    if (!text) {
      setCopyState("empty");
      return;
    }
    // Copy the list to the clipboard, then run the shortcut with input=clipboard — far
    // more reliable than passing the list through the URL.
    await copyText(text);
    window.location.href = remindersShortcutClipboardUrl(
      shortcutName.trim() || REMINDERS_SHORTCUT_NAME,
    );
  }

  if (items.length === 0) {
    return (
      <section className="shopping" aria-label="Shopping list">
        <h2 className="shopping__title">Shopping list</h2>
        <p className="shopping__empty">
          Nothing to buy yet — generate a plan to build your list.
        </p>
      </section>
    );
  }

  const groups = groupByCategory(items);

  return (
    <section className="shopping" aria-label="Shopping list">
      <div className="shopping__head">
        <h2 className="shopping__title">Shopping list</h2>
        <div className="shopping__actions">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={handleCopy}
          >
            {copyState === "copied" ? "Copied ✓" : "Copy list"}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={handleReminders}
          >
            Add to Apple Reminders
          </button>
        </div>
      </div>
      <span className="shopping__copy-status" role="status" aria-live="polite">
        {copyState === "copied" && "Copied unchecked items to your clipboard."}
        {copyState === "failed" && "Couldn't reach the clipboard — copy the list below."}
        {copyState === "empty" && "Everything's checked off — nothing to copy."}
      </span>
      <p className="shopping__hint">
        Check off what you already have — copy and Reminders both leave those out.
      </p>

      {onHand.length > 0 && (
        <p className="shopping__onhand" role="note">
          Not listed — you said you already have: {onHand.join(", ")}.
        </p>
      )}

      <details className="shopping__reminders-help">
        <summary>Set up “Add to Apple Reminders” (one time)</summary>
        <ol>
          <li>
            On your iPhone/Mac, open <strong>Shortcuts</strong> and create a new shortcut.
            Build these three actions, in order:
            <ul>
              <li>
                <strong>Split Text</strong> — set its input to the{" "}
                <strong>Shortcut Input</strong> variable, split by <em>New Lines</em>.
                (This is the usual gotcha: if it splits an empty “Text” instead of{" "}
                <em>Shortcut Input</em>, nothing gets added.)
              </li>
              <li>
                <strong>Repeat with Each</strong> — item in <em>Split Text</em>.
              </li>
              <li>
                Inside the repeat: <strong>Add New Reminder</strong> — tap the{" "}
                <em>title</em> (the first blue chip, right after “Add”) and set it to the{" "}
                <strong>Repeat Item</strong> variable; pick your grocery list. Leave the
                alert as <strong>No Alert</strong> — putting the text in the “with” alert
                field causes an “alert time invalid” error.
              </li>
            </ul>
          </li>
          <li>
            Enter your shortcut’s <strong>exact name</strong> here so the button can find
            it:
            <input
              type="text"
              className="shopping__shortcut-name"
              aria-label="Apple Shortcut name"
              value={shortcutName}
              onChange={(e) => updateShortcutName(e.target.value)}
              placeholder={REMINDERS_SHORTCUT_NAME}
            />
          </li>
          <li>
            Back here, tap “Add to Apple Reminders”. The app copies the list and runs your
            shortcut on the clipboard, so each line becomes its own reminder. (Your
            shortcut still just splits <strong>Shortcut Input</strong> — with the clipboard
            method that <em>is</em> the copied list.)
          </li>
        </ol>
      </details>

      {fallbackText !== null && (
        <div className="shopping__fallback">
          <label htmlFor="shopping-copytext" className="shopping__fallback-label">
            Copy this list:
          </label>
          <textarea
            id="shopping-copytext"
            className="shopping__fallback-text mono"
            readOnly
            rows={Math.min(14, fallbackText.split("\n").length + 1)}
            value={fallbackText}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}

      <div className="shopping__aisles">
        {groups.map(([category, group]) => (
          <fieldset key={category} className="shopping__aisle">
            <legend className="shopping__aisle-name">
              {prettyCategory(category)}
            </legend>
            <ul className="shopping__items">
              {group.map((item) => {
                const id = `shop-${category}-${item.name}`.replace(/\s+/g, "-");
                const isChecked = Boolean(checked[item.name]);
                return (
                  <li
                    key={item.name}
                    className={`shopping__item${isChecked ? " is-checked" : ""}`}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(item.name)}
                    />
                    <label htmlFor={id} className="shopping__item-label">
                      <span className="shopping__item-name">{item.name}</span>
                      <span className="mono shopping__item-qty">
                        {itemQty(item, units)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
