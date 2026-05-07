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

### Build gotcha (pnpm 11)

`pnpm-workspace.yaml` may carry an `allowBuilds:` map with placeholder values
for native-build packages. pnpm 11's pre-script `runDepsStatusCheck` aborts
`pnpm build` with `ERR_PNPM_IGNORED_BUILDS` until those are resolved. Until
the workspace file is updated, bypass with:

```bash
pnpm --config.verify-deps-before-run=false exec next build
```

## Environment

Add your environment variables in a `.env.local` file before running the app.
