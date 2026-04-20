import { defineConfig } from "cypress";
import * as fs from "fs";
import * as path from "path";

type PerfRecord = { url: string; method: string; durationMs: number; at: string };

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.ts",
    video: false,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      const perfLog: PerfRecord[] = [];
      on("task", {
        recordPerf(record: PerfRecord) {
          perfLog.push(record);
          return null;
        },
        writePerfLog() {
          const outPath = path.join(config.projectRoot, "cypress", "perf-log.json");
          fs.writeFileSync(outPath, JSON.stringify(perfLog, null, 2));
          return outPath;
        },
      });
      return config;
    },
  },
});
