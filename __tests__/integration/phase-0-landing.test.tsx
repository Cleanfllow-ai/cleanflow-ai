import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

function Hello() {
  return <h1>CleanFlow Test</h1>;
}

describe("Phase 0 smoke - component", () => {
  it("renders a component and RTL finds the heading", () => {
    render(<Hello />);
    expect(
      screen.getByRole("heading", { name: /cleanflow test/i })
    ).toBeInTheDocument();
  });
});
