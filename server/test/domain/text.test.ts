import { describe, it, expect } from "vitest";
import { singularize } from "../../src/domain/text.js";

describe("singularize", () => {
  it("leaves an already-singular word alone", () => {
    expect(singularize("egg")).toBe("egg");
    expect(singularize("rice")).toBe("rice");
    expect(singularize("salmon")).toBe("salmon");
  });

  it("drops a trailing 's'", () => {
    expect(singularize("eggs")).toBe("egg");
    expect(singularize("carrots")).toBe("carrot");
  });

  it("drops a trailing 'es'", () => {
    expect(singularize("tomatoes")).toBe("tomato");
  });

  it("turns 'ies' into 'y'", () => {
    expect(singularize("berries")).toBe("berry");
  });
});
