import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "../src/App";

test("renders the Meal Planner heading", () => {
  render(<App />);
  expect(screen.getByText("Meal Planner")).toBeInTheDocument();
});
