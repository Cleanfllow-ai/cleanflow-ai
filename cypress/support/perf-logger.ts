// Installs a default network intercept that records timings for every API call.
// Import from support/e2e.ts so every spec gets it.

export function installPerfLogger() {
  cy.intercept({ url: "**/api/**" }, (req) => {
    const start = Date.now();
    req.on("response", () => {
      const durationMs = Date.now() - start;
      cy.task("recordPerf", {
        url: req.url,
        method: req.method,
        durationMs,
        at: new Date().toISOString(),
      });
    });
  });
}
