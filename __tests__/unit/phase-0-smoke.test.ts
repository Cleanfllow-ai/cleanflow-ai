describe("Phase 0 smoke - unit", () => {
  it("confirms jest runs pure functions", () => {
    const add = (a: number, b: number) => a + b;
    expect(add(2, 3)).toBe(5);
  });

  it("confirms jest assertions work for strings", () => {
    expect("cleanflow".toUpperCase()).toBe("CLEANFLOW");
  });
});
