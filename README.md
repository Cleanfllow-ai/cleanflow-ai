# erp-transform-app

## Package manager: pnpm (NOT npm)

This project uses **pnpm** (see `pnpm-lock.yaml`). Do **not** run `npm install` —
it corrupts `node_modules` because pnpm uses a symlink-based dependency tree
(`.pnpm/` content-addressable store) that npm doesn't understand. The classic
failure mode is a build error like `Cannot find module .next/server/middleware-manifest.json`
because critical deps (e.g. SWC binaries) end up resolving to broken symlinks.

```bash
pnpm install --frozen-lockfile   # install (uses pnpm-lock.yaml exactly)
pnpm dev                          # dev server
pnpm build                        # production build
pnpm lint                         # ESLint check
```

If `pnpm` isn't installed: `npm install -g pnpm` (npm is fine for installing
pnpm itself; only `npm install` *inside this project* corrupts state).

### Recovering after an accidental `npm install`

```bash
rm -rf node_modules .next package-lock.json
pnpm install --frozen-lockfile
```

Do **not** delete `pnpm-lock.yaml` — that's the canonical lockfile.

### Native-build packages (pnpm 11)

`pnpm-workspace.yaml` declares `allowBuilds:` per package — pnpm 11 won't run
postinstall scripts for native-build packages unless explicitly allowed there.
Current settings: only `msw` runs (it copies the Service Worker JS into
`public/`); `@tailwindcss/oxide`, `sharp`, `cypress`, `aws-sdk`, and
`@vercel/speed-insights` are skipped because their postinstalls aren't needed
for our build (Tailwind v4 uses prebuilt wasm, Next.js Image works without
sharp, Cypress binary is downloaded by CI's separate Docker image, etc.).
See the comment block at the top of `pnpm-workspace.yaml` for full per-package
rationale.

## Environment

Add your environment variables in a `.env.local` file before running the app.
