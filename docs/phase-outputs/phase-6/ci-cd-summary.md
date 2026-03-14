# Phase 6: CI/CD, Packaging & Publish — Summary

## CI Pipeline (`.github/workflows/ci.yml`)

Runs on every PR to `main` and every push to `main`.

**Jobs (parallelized where possible):**

| Job | Dependencies | What it does |
|---|---|---|
| `lint` | — | ESLint across core, react, react-native |
| `typecheck` | — | Build core, typecheck all packages |
| `test-core` | — | Build & test `@anoncitizen/core` |
| `test-react` | test-core | Build & test `@anoncitizen/react` |
| `test-react-native` | test-core | Build & test `@anoncitizen/react-native` |
| `test-contracts` | — | Compile & test Solidity contracts |
| `test-circuits` | — | Install circom, run circuit tests |
| `e2e` | test-core, test-react | Build packages, run Playwright tests |

## Release Pipeline (`.github/workflows/release.yml`)

Triggered by version tag push (`v*`).

**Jobs:**
1. Full CI pipeline
2. Build all packages
3. Publish 4 packages to npm (`@anoncitizen/core`, `react`, `react-native`, `contracts`)
4. Create GitHub Release with auto-generated notes
5. Deploy contracts to Sepolia (non-alpha tags only)

## Changesets Configuration

- Independent versioning per package with linked group for coordinated major bumps
- Public access for all `@anoncitizen/*` scoped packages
- Changelog generation from changeset entries

## Package Configuration

All 4 publishable packages updated with:
- `publishConfig.access: "public"`
- `license: "MIT"`
- `repository`, `homepage`, `bugs` fields
- `keywords` for npm discoverability
- Contracts: `files` includes compiled ABIs (excludes debug files)

## Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `NPM_TOKEN` | npm publish authentication |
| `SEPOLIA_RPC_URL` | Contract deployment RPC endpoint |
| `DEPLOYER_PRIVATE_KEY` | Contract deployment wallet (testnet only) |

## Documentation

| File | Purpose |
|---|---|
| `README.md` | Root project overview, quick start, architecture |
| `packages/core/README.md` | Core SDK installation, API reference |
| `packages/react/README.md` | React hooks & components usage |
| `packages/react-native/README.md` | Expo mobile SDK usage |
| `packages/contracts/README.md` | Contract deployment, integration, public signals |
| `CONTRIBUTING.md` | Dev setup, testing, changesets workflow |
| `docs/release-checklist.md` | Step-by-step release procedure |
| `.env.example` | All environment variables documented |
