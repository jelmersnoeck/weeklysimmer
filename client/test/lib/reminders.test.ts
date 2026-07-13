import { describe, expect, test } from "vitest";
import {
  remindersShortcutUrl,
  remindersShortcutClipboardUrl,
  REMINDERS_SHORTCUT_NAME,
} from "../../src/lib/reminders";

describe("remindersShortcutUrl", () => {
  test("builds a run-shortcut deep link with the encoded list as text input", () => {
    const list = "Leek (2 pcs)\nMilk (1 l)";
    const url = remindersShortcutUrl(list);
    expect(url.startsWith("shortcuts://run-shortcut?")).toBe(true);
    expect(url).toContain(`name=${encodeURIComponent(REMINDERS_SHORTCUT_NAME)}`);
    expect(url).toContain("input=text");
    expect(url).toContain(`text=${encodeURIComponent(list)}`);
  });

  test("clipboard variant runs the named shortcut with input=clipboard", () => {
    const url = remindersShortcutClipboardUrl("JElmer Test");
    expect(url).toBe(
      `shortcuts://run-shortcut?name=${encodeURIComponent("JElmer Test")}&input=clipboard`,
    );
  });
});
