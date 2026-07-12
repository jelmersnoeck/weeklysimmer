import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { GeneratingPanel } from "../../src/components/GeneratingPanel";

describe("GeneratingPanel", () => {
  test("renders a rotating status message, elapsed timer and background note", () => {
    // Started 65s ago -> the timer should read 01:05.
    render(<GeneratingPanel startedAt={Date.now() - 65_000} />);

    // First status message from the pipeline.
    expect(screen.getByText(/searching for recipes/i)).toBeInTheDocument();

    // Elapsed timer in mm:ss.
    expect(screen.getByLabelText(/time elapsed/i)).toHaveTextContent("01:05");

    // Safe-to-leave note.
    expect(
      screen.getByText(/runs in the background — you can close this tab/i),
    ).toBeInTheDocument();
  });
});
