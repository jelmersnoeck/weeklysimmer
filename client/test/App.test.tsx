import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import App from "../src/App";

vi.mock("../src/api/client");
import * as api from "../src/api/client";

afterEach(() => {
  vi.clearAllMocks();
});

describe("App", () => {
  test("renders the app title and switches between views", async () => {
    const user = userEvent.setup();
    vi.mocked(api.listPlans).mockResolvedValue([]);

    render(<App />);

    expect(
      screen.getByRole("heading", { name: /the prep sheet/i }),
    ).toBeInTheDocument();

    // Dashboard is the default view; its empty-state invite appears.
    expect(
      await screen.findByRole("button", { name: /plan your first week/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^history$/i }));
    expect(
      await screen.findByText(/no past weeks yet/i),
    ).toBeInTheDocument();
  });
});
