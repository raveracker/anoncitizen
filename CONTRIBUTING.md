# Contributing to AnonCitizen

Thank you for your interest in contributing! This guide covers the fork-based workflow we use for all contributions.

## Prerequisites

- Node.js >= 18
- pnpm 10+
- circom 2.x (for circuit development)

## Getting Started

### 1. Fork the Repository

Click the **Fork** button on [github.com/anoncitizen/anoncitizen](https://github.com/anoncitizen/anoncitizen) to create your own copy.

### 2. Clone Your Fork

```bash
git clone https://github.com/<your-username>/anoncitizen.git
cd anoncitizen
```

### 3. Add Upstream Remote

```bash
git remote add upstream https://github.com/anoncitizen/anoncitizen.git
```

### 4. Install Dependencies

```bash
pnpm install
```

## Making Changes

### 1. Sync with Upstream

Before starting any work, make sure your fork is up to date:

```bash
git checkout main
git pull upstream main
```

### 2. Create a Feature Branch

```bash
git checkout -b feat/your-feature-name
```

Use a descriptive branch name:
- `feat/` — new feature
- `fix/` — bug fix
- `docs/` — documentation
- `refactor/` — code refactoring
- `test/` — adding tests

### 3. Make Your Changes

```bash
# Build all packages
pnpm turbo build

# Run all tests
pnpm turbo test

# Lint
pnpm turbo lint

# Typecheck
pnpm turbo typecheck

# Work on a specific package
pnpm --filter @anoncitizen/core test
pnpm --filter @anoncitizen/react build
pnpm --filter @anoncitizen/contracts test
```

### 4. Add a Changeset

For any user-facing change, create a changeset:

```bash
pnpm changeset
```

Select the affected packages, choose the semver bump type, and write a summary.

### 5. Commit and Push

```bash
git add .
git commit -m "feat: description of your change"
git push origin feat/your-feature-name
```

### 6. Open a Pull Request

Go to your fork on GitHub and click **"Compare & pull request"**. Target the `main` branch of the upstream repository (`anoncitizen/anoncitizen`).

In your PR description:
- Describe what the change does and why
- Reference any related issues (e.g. `Fixes #42`)
- Include screenshots for UI changes

### 7. CI Checks

All PRs must pass the CI pipeline before merging:
- Lint (ESLint)
- Typecheck (TypeScript)
- Unit tests (core, react, contracts, circuits)
- E2E tests (Playwright)

### 8. Keeping Your Branch Updated

If `main` has moved ahead while your PR is open:

```bash
git checkout feat/your-feature-name
git pull upstream main
# Resolve any conflicts
git push origin feat/your-feature-name
```

## Project Structure

```
packages/
  circuits/    — Circom 2.x ZK circuits
  core/        — TypeScript SDK (QR parsing, proof gen, verification)
  react/       — React hooks & components
  contracts/   — Solidity verifier + nullifier tracking
examples/
  web-demo/    — Vite + React demo app
tests/
  e2e/         — Playwright E2E tests
```

## Testing

| Package | Framework | Command |
|---|---|---|
| Core SDK | vitest | `pnpm --filter @anoncitizen/core test` |
| React SDK | vitest + testing-library | `pnpm --filter @anoncitizen/react test` |
| Contracts | Hardhat + chai | `pnpm --filter @anoncitizen/contracts test` |
| Circuits | circom_tester + Mocha | `pnpm --filter @anoncitizen/circuits test` |
| E2E | Playwright | `npx playwright test --config=tests/e2e/playwright.config.ts` |

## Circuit Development

Circuit changes require extra care:

1. Document constraint count changes
2. Run circuit tests: `pnpm --filter @anoncitizen/circuits test`
3. Never use `<--` (unconstrained hint) without a corresponding constraint
4. Circuit changes trigger the `build-circuits` workflow automatically on merge

## Security

If you discover a security vulnerability, please report it responsibly. **Do not open a public issue.** Contact the maintainers directly.
