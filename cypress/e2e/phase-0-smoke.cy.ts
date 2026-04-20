describe("Phase 0 smoke - E2E", () => {
  it("loads the landing page and sees a 2xx response", () => {
    cy.visit("/");
    cy.get("body").should("be.visible");
    cy.document().its("readyState").should("eq", "complete");
  });
});
