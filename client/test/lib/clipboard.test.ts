import { afterEach, describe, expect, test, vi } from "vitest";
import { copyText } from "../../src/lib/clipboard";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyText", () => {
  test("uses the async clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    expect(await copyText("hello")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  test("falls back to execCommand when the clipboard API is unavailable", async () => {
    vi.stubGlobal("navigator", {}); // no clipboard (e.g. insecure LAN context)
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec; // jsdom doesn't provide it; define for the fallback path

    expect(await copyText("hello")).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
  });
});
