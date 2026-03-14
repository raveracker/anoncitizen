# Phase 1 — Sprint Backlog

## Legend

- **Size:** S = Small (< 1 day), M = Medium (1-3 days), L = Large (3-5 days), XL = Extra Large (5+ days)
- **Priority:** P0 = Critical path, P1 = High, P2 = Medium
- **Blocked by:** Story IDs that must complete before this story can start

---

## Phase 2: Circom Circuits

| ID | Story | Package | Size | Priority | Blocked By | Acceptance Criteria |
|----|-------|---------|------|----------|------------|-------------------|
| C-01 | Initialize monorepo workspace (pnpm, Turborepo, tsconfig, .gitignore) | root | M | P0 | — | `pnpm install` succeeds, `turbo build` runs empty pipeline, all 5 package dirs exist with package.json |
| C-02 | Set up circuits package (circom compiler, snarkjs dev dep, directory structure) | circuits | S | P0 | C-01 | `circom --version` works, package.json has correct scripts, lib/ and test/ dirs exist |
| C-03 | Build SHA-256 hasher sub-circuit | circuits/lib | L | P0 | C-02 | Template compiles, handles variable-length input with padding, constraint count documented, passes test vectors from NIST |
| C-04 | Build RSA-2048 signature verifier sub-circuit | circuits/lib | XL | P0 | C-02 | Template compiles, verifies valid RSA-2048 PKCS#1v1.5 + SHA-256 signature, rejects invalid signatures, constraint count documented |
| C-05 | Build field extractor sub-circuit (delimiter parsing, conditional reveal) | circuits/lib | L | P0 | C-02 | Extracts DOB, gender, state, pincode from delimiter-separated data. Conditional reveal works (flag=0 → output=0). Tests with sample data. |
| C-06 | Build nullifier computation sub-circuit (Poseidon) | circuits/lib | M | P0 | C-02 | `nullifier = Poseidon(seed, Poseidon(photoChunks))`, deterministic output for same inputs, different output for different seeds |
| C-07 | Build IST→UNIX UTC timestamp converter sub-circuit | circuits/lib | S | P1 | C-02 | Correctly subtracts 19800s offset, handles Aadhaar timestamp format, test with known IST/UTC pairs |
| C-08 | Build main aadhaar-verifier circuit (compose all sub-circuits) | circuits | XL | P0 | C-03, C-04, C-05, C-06, C-07 | Main template compiles, all sub-circuits wired correctly, all inputs/outputs match circuit-io-schema.md, constraint count documented |
| C-09 | Trusted setup scripts (ptau download, compile, zkey gen, vkey export, Solidity export) | circuits/scripts | M | P0 | C-08 | Scripts run end-to-end, produce .wasm, .zkey, verification_key.json, Groth16Verifier.sol |
| C-10 | Circuit unit tests with sample Aadhaar QR data | circuits/test | L | P0 | C-08, C-09 | Full proof generation + verification with test vectors. Edge cases: empty optional fields, all reveals on/off, invalid signature rejection |

### Phase 2 Critical Path

```
C-01 → C-02 → [C-03, C-04, C-05, C-06, C-07] (parallel) → C-08 → C-09 → C-10
```

**Bottleneck:** C-04 (RSA verifier) is the highest-risk, highest-complexity item. It should start immediately after C-02.

---

## Phase 3A: Solidity Contracts

| ID | Story | Package | Size | Priority | Blocked By | Acceptance Criteria |
|----|-------|---------|------|----------|------------|-------------------|
| S-01 | Set up contracts package (Hardhat, ethers, OpenZeppelin, TypeChain) | contracts | S | P0 | C-01 | `npx hardhat compile` succeeds, TypeChain types generated |
| S-02 | Import auto-generated Groth16Verifier.sol from circuit build | contracts | S | P0 | C-09, S-01 | Verifier contract compiles, matches circuit verification key |
| S-03 | Build AnonCitizen.sol wrapper contract (verify + nullifier tracking + events) | contracts | M | P0 | S-02 | Contract accepts proof + public signals, calls verifier, stores nullifiers in mapping, emits ProofVerified event, rejects duplicate nullifiers |
| S-04 | Write Hardhat test suite for contracts | contracts/test | M | P0 | S-03 | Tests cover: valid proof verification, invalid proof rejection, nullifier replay prevention, event emission, gas benchmarks documented |
| S-05 | Deployment scripts for testnets (Sepolia, Mumbai/Amoy) | contracts/scripts | S | P1 | S-03 | `npx hardhat run scripts/deploy.ts --network sepolia` succeeds, contract addresses logged |
| S-06 | Document gas benchmarks for verifyProof | docs | S | P1 | S-04 | Gas cost documented: deployment, first verify, subsequent verify, nullifier check |

---

## Phase 3B: Core TypeScript SDK

| ID | Story | Package | Size | Priority | Blocked By | Acceptance Criteria |
|----|-------|---------|------|----------|------------|-------------------|
| K-01 | Set up core package (TypeScript strict, tsup/rollup bundler, package.json exports) | core | S | P0 | C-01 | `pnpm build` produces ESM + CJS outputs, types are exported correctly |
| K-02 | QR code parser: extract signed data + signature from Aadhaar QR image | core/src | L | P0 | K-01 | Parses QR from image buffer, decompresses zlib, extracts signed data and signature bytes, parses all delimiter-separated fields |
| K-03 | Pre-verification: validate RSA signature outside circuit (fast-fail) | core/src | M | P1 | K-02 | Verifies RSA-2048 PKCS#1v1.5 signature using Node.js crypto / WebCrypto. Returns pass/fail before expensive proof generation. |
| K-04 | Circuit input preparation: format signedData, signature, pubKey as circuit-compatible arrays | core/src | M | P0 | K-02, C-08 | Converts raw bytes to field element arrays matching circuit signal sizes. Handles padding, chunking, limb conversion. |
| K-05 | Proof generation: call snarkjs.groth16.fullProve, manage artifact loading | core/src | M | P0 | K-04, C-09 | Generates proof from ProofRequest. Loads .wasm and .zkey (from bundle or URL). Returns { proof, publicSignals }. |
| K-06 | Off-chain verification: call snarkjs.groth16.verify | core/src | S | P0 | K-05 | Verifies proof against bundled verification_key.json. Returns VerificationResult with decoded public signals. |
| K-07 | Signal hashing utility (Poseidon hash of arbitrary string) | core/src | S | P1 | K-01 | `hashSignal("hello")` returns deterministic field element. Default signal "1" produces consistent hash. |
| K-08 | Contract calldata formatter (proof → Solidity-compatible format) | core/src | S | P1 | K-05, S-03 | `formatProofForContract(proof)` returns { pA, pB, pC, pubSignals } matching contract ABI |
| K-09 | Public API barrel exports + comprehensive TypeScript types | core/src | S | P0 | K-05, K-06, K-07, K-08 | `index.ts` exports all public functions and types. No internal implementation details leak. |
| K-10 | Core SDK unit tests | core/test | M | P0 | K-09 | Test coverage for: QR parsing (valid/invalid), input preparation, proof generation (with test vectors), off-chain verification, signal hashing |
| K-11 | API surface review | docs | M | P1 | K-09 | Review document covering: naming consistency, error handling patterns, type safety, developer ergonomics. Saved to phase-3 outputs. |

### Phase 3 Critical Path

```
Track A: C-09 → S-02 → S-03 → S-04
Track B: K-02 → K-04 → K-05 → K-06 → K-09 → K-10
Merge:   K-08 depends on both K-05 and S-03
```

---

## Phase 4: React + React Native SDKs

| ID | Story | Package | Size | Priority | Blocked By | Acceptance Criteria |
|----|-------|---------|------|----------|------------|-------------------|
| R-01 | Set up react package (React 19+ peer dep, tsup bundler, package.json) | react | S | P0 | K-09 | Package builds, peer dependency on react ≥ 19 and @anoncitizen/core |
| R-02 | `useAnonCitizen` hook (initialize SDK, manage zkey loading state) | react/src | M | P0 | R-01 | Hook manages initialization lifecycle, exposes loading/ready/error states, fetches zkey on mount |
| R-03 | `useProofGeneration` hook (generate proof from QR data) | react/src | M | P0 | R-02 | Accepts ProofRequest, manages generating/success/error states, returns proof result, runs in web worker |
| R-04 | `useVerification` hook (verify proof off-chain) | react/src | S | P1 | R-02 | Accepts proof, returns verification result with loading state |
| R-05 | QR Scanner component (webcam-based, file upload fallback) | react/src | M | P1 | R-01 | Component renders camera view, detects QR codes, returns raw QR bytes via callback, fallback file upload for desktop |
| R-06 | React SDK unit tests | react/test | M | P0 | R-03, R-04, R-05 | Hook behavior tests (React Testing Library), component render tests |
| RN-01 | Set up react-native package (Expo peer dep, package.json) | react-native | S | P0 | K-09 | Package builds, peer dependencies on react-native, expo, expo-camera |
| RN-02 | `useAnonCitizen` hook (mobile-optimized, native asset loading) | react-native/src | M | P0 | RN-01 | Same API as react version but loads circuit artifacts from native bundle or downloads to file system |
| RN-03 | `useProofGeneration` hook (native-threaded proof generation) | react-native/src | L | P0 | RN-02 | Proof generation runs on background thread (JSI/native module or web worker polyfill). Doesn't block UI. |
| RN-04 | Camera QR Scanner component (expo-camera) | react-native/src | M | P1 | RN-01 | Uses expo-camera for live QR scanning, returns raw bytes, handles permissions |
| RN-05 | React Native SDK tests | react-native/test | M | P0 | RN-03, RN-04 | Unit tests for hooks and components |
| D-01 | Web demo app (Vite + React) — full proof flow | examples | L | P1 | R-06 | Demo shows: QR upload → proof generation (with progress) → verification result display |
| D-02 | Mobile demo app (Expo) — full proof flow | examples | L | P1 | RN-05 | Demo shows: camera scan → proof generation → verification result |

### Phase 4 Critical Path

```
K-09 → [R-01, RN-01] (parallel) → [R-02→R-03, RN-02→RN-03] (parallel) → [D-01, D-02] (parallel)
```

---

## Phase 5: QA, Security & Code Review

| ID | Story | Package | Size | Priority | Blocked By | Acceptance Criteria |
|----|-------|---------|------|----------|------------|-------------------|
| Q-01 | Write test strategy document | docs | M | P0 | All Phase 4 | Document covers: test pyramid, coverage targets, test data strategy, CI integration |
| Q-02 | Fill missing unit tests across all packages to meet coverage targets | all | L | P0 | Q-01 | Coverage ≥ 80% lines for core, react, react-native. 100% for critical paths (proof gen, verification). |
| Q-03 | E2E tests for web demo (Playwright) | tests/e2e | M | P1 | D-01 | Tests: QR upload → proof generated → verification displayed. Happy path + error cases. |
| Q-04 | Cryptographic security audit | docs | L | P0 | All Phase 4 | Audit covers: RSA implementation, SHA-256 correctness, nullifier uniqueness, signalHash binding, timestamp manipulation, QR replay. All critical/high findings documented. |
| Q-05 | Contract security audit | docs | M | P0 | S-04 | Audit covers: reentrancy, nullifier double-spend, gas griefing, access control. All findings documented. |
| Q-06 | Full codebase quality review | docs | M | P1 | All Phase 4 | Review covers: TypeScript strictness, error handling, dependency hygiene, bundle sizes. Findings documented with severity. |

### Phase 5 Quality Gate

All stories complete. Zero critical findings open. All high findings resolved or have accepted risk + mitigation plan.

---

## Phase 6: CI/CD & Publishing

| ID | Story | Package | Size | Priority | Blocked By | Acceptance Criteria |
|----|-------|---------|------|----------|------------|-------------------|
| CI-01 | GitHub Actions CI workflow (lint → compile → test) | .github | M | P0 | Phase 5 gate | PR checks run: lint, typecheck, circuit compile, contract test, SDK test. All pass. |
| CI-02 | Release workflow (tag → build → npm publish) | .github | M | P0 | CI-01 | Tagging `v*` triggers: build all packages, publish @anoncitizen/core, @anoncitizen/react, @anoncitizen/react-native, @anoncitizen/contracts to npm |
| CI-03 | Changesets configuration for monorepo versioning | root | S | P1 | CI-01 | `npx changeset` works, version bumps cascade correctly through dependency graph |
| CI-04 | Package.json finalization (main/module/types/exports, peer deps, publish config) | all packages | M | P0 | CI-01 | All 4 published packages have correct entry points, type definitions, sideEffects flags, files arrays |
| CI-05 | Secrets management documentation (npm tokens, RPC URLs) | docs | S | P1 | CI-02 | GitHub secrets documented, .env.example for local dev, no secrets in code |
| CI-06 | Tag v0.1.0 release | root | S | P0 | CI-02, CI-04 | Tag triggers CI, all packages published successfully, changelog generated |

---

## Project Critical Path (End-to-End)

```
C-01 → C-02 → C-04 (RSA verifier — highest risk)
                 ↓
         [C-03, C-05, C-06, C-07] (parallel with C-04)
                 ↓
              C-08 (main circuit — all sub-circuits must be done)
                 ↓
              C-09 (trusted setup)
                 ↓
              C-10 (circuit tests)
                 ↓
     ┌───────────┴───────────┐
     ↓                       ↓
   S-02→S-03→S-04       K-02→K-04→K-05→K-06→K-09→K-10
     ↓                       ↓
     └───────────┬───────────┘
                 ↓
     [R-01→R-03, RN-01→RN-03] (parallel)
                 ↓
     [D-01, D-02] (parallel demos)
                 ↓
     Q-01→[Q-02, Q-03, Q-04, Q-05, Q-06] (parallel QA)
                 ↓
     CI-01→CI-02→CI-06 (v0.1.0)
```

### Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| RSA-2048 in-circuit constraint explosion | High — could make proving impractical | Medium | Use battle-tested circom-rsa-verify library (PSE/anon-aadhaar). Benchmark early in C-04. |
| SHA-256 constraint count too high for large signed data | High — 10KB input = ~5M constraints | Medium | Consider truncating signed data or using a two-pass approach (hash outside, verify hash inside). Evaluate in C-03. |
| React Native proving time too slow | Medium — poor mobile UX | High | Benchmark in RN-03. Fallback: server-assisted proving with MPC. |
| Aadhaar QR format changes | Medium — breaks parser | Low | Version detection in K-02. Support V2 initially, design parser to be extensible. |
| UIDAI public key rotation | Low — infrequent | Low | pubKeyHash output allows verifiers to maintain key registry. SDK provides key update mechanism. |
| zkey download size/speed | Medium — 50-200MB download | Medium | IPFS with CDN gateway. Progressive loading. Cache in IndexedDB (web) / filesystem (mobile). |

---

## Story Count Summary

| Phase | Stories | S | M | L | XL |
|-------|---------|---|---|---|-----|
| Phase 2 (Circuits) | 10 | 2 | 3 | 3 | 2 |
| Phase 3A (Contracts) | 6 | 3 | 2 | 0 | 1 |
| Phase 3B (Core SDK) | 11 | 4 | 5 | 1 | 1 |
| Phase 4 (SDKs) | 13 | 3 | 6 | 3 | 1 |
| Phase 5 (QA) | 6 | 0 | 3 | 2 | 1 |
| Phase 6 (CI/CD) | 6 | 3 | 3 | 0 | 0 |
| **Total** | **52** | **15** | **22** | **9** | **6** |
