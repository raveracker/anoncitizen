# Contributing to AnonCitizen

## Prerequisites

- Node.js >= 18
- pnpm 10+
- circom 2.x (for circuit development)

## Setup

```bash
git clone https://github.com/anoncitizen/anoncitizen.git
cd anoncitizen
pnpm install
```

## Development

```bash
# Build all packages (respects dependency order)
pnpm turbo build

# Run all tests
pnpm turbo test

# Lint (ESLint)
pnpm turbo lint

# Typecheck
pnpm turbo typecheck

# Work on a specific package
pnpm --filter @anoncitizen/core test
pnpm --filter @anoncitizen/react build
pnpm --filter @anoncitizen/contracts test
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
docs/
  phase-outputs/ — Architecture docs, audits, benchmarks
  decisions/     — Architecture Decision Records (ADRs)
```

## Making Changes

1. Create a feature branch from `main`
2. Make your changes
3. Add a changeset: `pnpm changeset`
4. Run tests: `pnpm turbo test`
5. Open a PR against `main`

## Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning. When making a user-facing change:

```bash
pnpm changeset
```

Select the affected packages, choose the semver bump type, and write a summary.

## Testing

- **Core SDK**: `vitest` — unit tests for QR parsing, proof generation, verification
- **React/React Native**: `vitest` + `@testing-library/react` — hook and component tests
- **Contracts**: `hardhat test` — Solidity unit tests with chai
- **Circuits**: `circom_tester` — signal correctness and constraint tests
- **E2E**: `playwright` — web demo end-to-end flows

## Circuit Development

Circuit changes require extra care:

1. Document constraint count changes
2. Run circuit tests: `pnpm --filter @anoncitizen/circuits test`
3. Update `docs/phase-outputs/phase-2/circuit-benchmarks.md` if constraint counts change
4. Never use `<--` (unconstrained hint) without a corresponding constraint

## Security

If you discover a security vulnerability, please report it responsibly. Do not open a public issue. Contact the maintainers directly.
