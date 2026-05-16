const nextJest = require("next/jest.js");

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jest-environment-jsdom",
  setupFiles: ["<rootDir>/__tests__/setup-fetch-polyfill.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // next/jest's SWC rewrites `import { X } from "lucide-react"` into
    // `import { default as X } from "lucide-react/dist/esm/icons/<kebab>"`
    // (via modularizeImports in next.config.mjs). Those per-icon files are
    // ESM and jest can't parse them, so redirect every icon path to a
    // generic React-component mock.
    "^lucide-react/dist/esm/icons/.*$": "<rootDir>/__tests__/__mocks__/lucide-icon.js",
    "^lucide-react$": "<rootDir>/__tests__/__mocks__/lucide-icon.js",
  },
  testMatch: [
    "<rootDir>/__tests__/**/*.test.ts",
    "<rootDir>/__tests__/**/*.test.tsx",
  ],
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "modules/**/*.{ts,tsx}",
    "shared/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json-summary"],
};

module.exports = createJestConfig(config);
