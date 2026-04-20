import "./commands";
import { installPerfLogger } from "./perf-logger";

beforeEach(() => {
  installPerfLogger();
});

after(() => {
  cy.task("writePerfLog");
});
