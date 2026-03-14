# Release Checklist

## Pre-release

- [ ] All CI checks pass on `main`
- [ ] No Critical or High security findings open
- [ ] Trusted setup ceremony completed (Groth16Verifier.sol has real keys)
- [ ] Trusted pubKeyHash registered in deployed AnonCitizen contract
- [ ] Circuit artifacts (WASM, zkey) uploaded to IPFS/CDN
- [ ] Verification key JSON uploaded alongside artifacts
- [ ] zkey SHA-256 hash recorded in documentation

## Version Bump

- [ ] Create changeset: `pnpm changeset`
- [ ] Review generated changelog entries
- [ ] Version packages: `pnpm changeset version`
- [ ] Commit version bumps and changelogs

## Build & Test

- [ ] `pnpm turbo build` — all packages build clean
- [ ] `pnpm turbo test` — all tests pass
- [ ] `pnpm turbo typecheck` — no type errors
- [ ] Contract tests pass with real verification keys
- [ ] Manual test: web demo end-to-end flow
- [ ] Manual test: mobile demo end-to-end flow

## Publish

- [ ] Tag release: `git tag v0.x.0`
- [ ] Push tag: `git push origin v0.x.0`
- [ ] Verify GitHub Actions release workflow triggers
- [ ] Verify all 4 packages published to npm:
  - [ ] `@anoncitizen/core`
  - [ ] `@anoncitizen/react`
  - [ ] `@anoncitizen/react-native`
  - [ ] `@anoncitizen/contracts`
- [ ] Verify npm packages install correctly: `npm install @anoncitizen/core`

## Post-release

- [ ] Create GitHub Release with notes
- [ ] Deploy contracts to Sepolia testnet (if not auto-deployed)
- [ ] Record deployed contract addresses in README
- [ ] Announce release
