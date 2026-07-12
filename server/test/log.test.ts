import { describe, it, expect, vi, afterEach } from "vitest";
import { formatLog, log, logError } from "../src/log.js";

describe("formatLog", () => {
  it("formats scope and message with an HH:MM:SS timestamp", () => {
    const line = formatLog("generate", "job abc queued");
    expect(line).toMatch(/^\[\d{2}:\d{2}:\d{2}\] \[generate\] job abc queued$/);
  });

  it("appends JSON of extra when present", () => {
    const line = formatLog("llm", "returned", { meals: 3 });
    expect(line).toMatch(/^\[\d{2}:\d{2}:\d{2}\] \[llm\] returned \{"meals":3\}$/);
  });
});

describe("log / logError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("log writes the formatted line to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("scope", "hello");
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toMatch(/^\[\d{2}:\d{2}:\d{2}\] \[scope\] hello$/);
  });

  it("logError writes to console.error with the stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");
    logError("scope", "failed", err);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toMatch(/^\[\d{2}:\d{2}:\d{2}\] \[scope\] failed$/);
    expect(spy.mock.calls[0][1]).toContain("boom");
  });
});
