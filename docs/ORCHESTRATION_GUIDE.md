# AnonCitizen — Claude Code Orchestration Guide

## Project Context

AnonCitizen is a zero-knowledge proof protocol for Aadhaar identity verification. This is a **cryptographic SDK monorepo** with Circom circuits, Solidity contracts, TypeScript packages, and mobile support — not a typical web app.

### What Makes This Project Unique

| Dimension | Implication for Orchestration |
|-----------|-------------------------------|
| Circom ZK circuits | No marketplace skill exists for this — needs a **custom skill** |
| Solidity smart contracts | Needs custom skill (marketplace has no Solidity/EVM skill) |
| npm monorepo (4 packages) | Use `monorepo-navigator` from POWERFUL tier |
| Cryptography (RSA, SHA-256, zk-SNARKs) | `senior-security` covers crypto patterns; custom skill fills ZK gaps |
| React + React Native (Expo) SDK | `senior-frontend` handles this well |
| Privacy protocol (not a product) | `product-manager-toolkit` is overkill; `agile-product-owner` fits for backlog |

---

## Monorepo Structure

```
anoncitizen/
├── .claude/
│   ├── CLAUDE.md
│   ├── settings.json
│   ├── skills/
│   │   ├── circom-circuit-engineer/          # CUSTOM — you create this
│   │   │   ├── SKILL.md
│   │   │   └── references/
│   │   │       ├── circom_syntax.md
│   │   │       ├── zk_snark_patterns.md
│   │   │       └── aadhaar_qr_spec.md
│   │   └── solidity-contract-engineer/       # CUSTOM — you create this
│   │       ├── SKILL.md
│   │       └── references/
│   │           ├── verifier_patterns.md
│   │           └── erc4337_integration.md
│   └── commands/                             # Phase orchestration commands
│       ├── phase-1-plan.md
│       ├── phase-2-circuits.md
│       ├── phase-3-contracts-core.md
│       ├── phase-4-sdks.md
│       ├── phase-5-qa-security.md
│       ├── phase-6-cicd-publish.md
│       └── orchestrate.md
├── docs/
│   ├── requirements.md                       # Your project plan (uploaded)
│   ├── proving_flow.png                      # Your circuit diagram
│   └── phase-outputs/
│       ├── phase-1/
│       ├── phase-2/
│       ├── phase-3/
│       ├── phase-4/
│       ├── phase-5/
│       └── phase-6/
├── packages/
│   ├── circuits/                             # Circom circuits
│   │   ├── aadhaar-verifier.circom
│   │   ├── lib/                              # Sub-circuits
│   │   ├── scripts/                          # ptau, compile, prove, verify
│   │   └── test/
│   ├── core/                                 # @anoncitizen/core
│   │   ├── src/
│   │   ├── test/
│   │   └── package.json
│   ├── react/                                # @anoncitizen/react
│   │   ├── src/
│   │   ├── test/
│   │   └── package.json
│   ├── react-native/                         # @anoncitizen/react-native
│   │   ├── src/
│   │   ├── test/
│   │   └── package.json
│   └── contracts/                            # @anoncitizen/contracts
│       ├── contracts/
│       ├── test/
│       ├── scripts/
│       └── hardhat.config.ts
├── package.json                              # Workspace root
├── turbo.json                                # or pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Skill Mapping

### From Your Installed Marketplace Skills

| Skill | Phase Used | Why It's Needed |
|-------|-----------|-----------------|
| `senior-architect` | Phase 1 | System architecture, package boundaries, data flow design |
| `agile-product-owner` | Phase 1 | Break requirements into sprint-ready backlog |
| `database-schema-designer` | Phase 2 | Circuit I/O schema definition (repurposed for signal schemas) |
| `senior-backend` | Phase 3 | Core SDK TypeScript logic — proof generation pipeline |
| `senior-frontend` | Phase 4 | React hooks/components + React Native Expo SDK |
| `senior-security` | Phase 5 | Crypto audit, threat modeling, RSA/SHA-256 review |
| `senior-qa` | Phase 5 | Test strategy, unit/integration test suites |
| `playwright-pro` | Phase 5 | E2E tests for React SDK demo app |
| `code-reviewer` | Phase 5 | Full codebase quality review |
| `monorepo-navigator` | All | Workspace dependency management, impact analysis |
| `ci-cd-pipeline-builder` | Phase 6 | GitHub Actions for build/test/publish pipeline |
| `release-manager` | Phase 6 | npm publish orchestration, semver, changelog |
| `senior-devops` | Phase 6 | Deployment config, secrets, environment setup |
| `api-design-reviewer` | Phase 3 | SDK public API surface review |

### Skills from Your List That DON'T Fit

| Skill | Why Excluded |
|-------|-------------|
| `startup-cto` / `cto-advisor` | This is a focused protocol, not a startup needing business strategy |
| `product-strategist` | No product/market positioning needed — this is an SDK |
| `tech-stack-evaluator` | Stack is already decided (Circom + Solidity + TS + React + Expo) |
| `roadmap-communicator` | Overkill for a 4-package SDK |
| `senior-data-engineer` | No data pipelines — the "data" here is circuit signals |
| `senior-fullstack` | Separate frontend/backend skills are more precise |
| `ui-design-system` | SDK, not a consumer UI product |
| `ux-researcher-designer` | No UX research needed for a developer SDK |

### NEW Custom Skills You Need to Create

These fill critical gaps that no marketplace skill covers:

#### 1. `circom-circuit-engineer` (MUST CREATE)

```markdown
---
name: circom-circuit-engineer
description: "ZK circuit design and implementation using Circom and snarkjs.
  Use when writing, reviewing, or debugging Circom circuits, designing circuit
  I/O schemas, optimizing constraint counts, setting up trusted setup (ptau),
  generating/verifying proofs, or working with zk-SNARKs. Triggers on any mention
  of Circom, circuits, constraints, signals, zk-SNARK, groth16, plonk, ptau,
  witness generation, or proof verification."
---

# Circom Circuit Engineer

You are a senior ZK circuit engineer specializing in Circom 2.x and snarkjs.

## Core Responsibilities
- Design and implement Circom circuits with minimal constraint count
- Define circuit signals (private inputs, public inputs, outputs)
- Write sub-circuits (templates) for: SHA-256, RSA verification, field extraction,
  nullifier computation, timestamp conversion
- Set up and execute trusted setup ceremonies (Powers of Tau + Phase 2)
- Generate and verify zk-SNARK proofs (Groth16)
- Optimize circuits for mobile proof generation performance

## Circuit Design Principles
- Keep constraint count minimal — every constraint adds proving time
- Use component composition (templates calling templates)
- Private signals for sensitive data (signature, signed data)
- Public signals only for verifiable outputs and optional reveals
- Test with small inputs first, scale up

## AnonCitizen Circuit Architecture
Refer to references/aadhaar_qr_spec.md for the Aadhaar QR data format.

The main circuit `aadhaar-verifier` must:
1. SHA-256 hash the signed data → verify integrity
2. RSA signature verification against UIDAI public key
3. Extract photo bytes for nullifier generation
4. Conditionally extract identity fields (age>18, gender, state, pincode)
5. Compute nullifier = hash(nullifierSeed, photo)
6. Convert IST timestamp to UNIX UTC
7. Bind signalHash with constraints

## File Conventions
- Main circuit: packages/circuits/aadhaar-verifier.circom
- Sub-circuits: packages/circuits/lib/
- Trusted setup: packages/circuits/scripts/setup.sh
- Tests: packages/circuits/test/

## References
- Read references/circom_syntax.md for Circom 2.x syntax and template patterns
- Read references/zk_snark_patterns.md for common ZK circuit patterns
  (Poseidon hash, RSA in-circuit, SHA-256 chunking)
- Read references/aadhaar_qr_spec.md for Aadhaar secure QR data specification
```

#### 2. `solidity-contract-engineer` (MUST CREATE)

```markdown
---
name: solidity-contract-engineer
description: "Solidity smart contract development for EVM chains. Use when writing,
  reviewing, testing, or deploying Solidity contracts, working with Hardhat/Foundry,
  implementing on-chain proof verification, or integrating with ERC standards.
  Triggers on any mention of Solidity, smart contracts, Hardhat, Foundry,
  EVM, on-chain verification, or contract deployment."
---

# Solidity Contract Engineer

You are a senior Solidity engineer specializing in ZK proof verification contracts.

## Core Responsibilities
- Write Solidity verifier contracts generated from snarkjs
- Build wrapper contracts for proof submission and verification
- Implement signal binding and nullifier tracking
- Gas optimization for on-chain verification
- Hardhat test suites with ethers.js
- Deployment scripts for EVM chains

## AnonCitizen Contract Architecture
- `AnonCitizenVerifier.sol` — auto-generated Groth16 verifier from snarkjs
- `AnonCitizen.sol` — wrapper contract that:
  - Accepts proof + public signals
  - Verifies via the verifier contract
  - Tracks used nullifiers to prevent replay
  - Emits events for verified proofs
  - Optional: ERC-4337 compatible for account abstraction

## File Conventions
- Contracts: packages/contracts/contracts/
- Tests: packages/contracts/test/
- Deploy scripts: packages/contracts/scripts/
- Hardhat config: packages/contracts/hardhat.config.ts

## Security Patterns
- Reentrancy guards on all state-changing functions
- Nullifier double-spend prevention (mapping + require)
- Access control for admin functions
- Gas-efficient proof verification (calldata over memory)
- Immutable verifier address pattern
```

---

## 6-Phase Orchestration

### Phase 1: Architecture & Planning

**Goal:** Define system architecture, package boundaries, circuit I/O schema, and sprint backlog.

**Skills:** `senior-architect` → `agile-product-owner`

| Step | Skill | Task | Output |
|------|-------|------|--------|
| 1 | `senior-architect` | Design monorepo architecture from requirements.md and proving_flow diagram. Define package boundaries, dependency graph between packages, circuit-to-SDK data flow, on-chain vs off-chain verification paths. | `docs/phase-outputs/phase-1/architecture.md` |
| 2 | `senior-architect` | Define the circuit I/O schema: exact private inputs, public inputs, outputs, optional parameters. Map each to the proving_flow diagram. | `docs/phase-outputs/phase-1/circuit-io-schema.md` |
| 3 | `agile-product-owner` | Break everything into a sprint backlog organized by package, with dependencies mapped. | `docs/phase-outputs/phase-1/sprint-backlog.md` |

**Checkpoint:** Review architecture + circuit I/O schema before any code is written.

---

### Phase 2: Circom Circuits

**Goal:** Implement and test the `aadhaar-verifier` circuit and all sub-circuits.

**Skills:** `circom-circuit-engineer` (custom) + `monorepo-navigator`

| Step | Skill | Task | Output |
|------|-------|------|--------|
| 1 | `monorepo-navigator` | Initialize monorepo workspace (pnpm/turbo), create packages/circuits/ structure | Workspace config files |
| 2 | `circom-circuit-engineer` | Build sub-circuit: SHA-256 hasher template | `packages/circuits/lib/sha256.circom` |
| 3 | `circom-circuit-engineer` | Build sub-circuit: RSA signature verifier template | `packages/circuits/lib/rsa_verifier.circom` |
| 4 | `circom-circuit-engineer` | Build sub-circuit: Field extractor (age, gender, state, pincode) with conditional reveal | `packages/circuits/lib/field_extractor.circom` |
| 5 | `circom-circuit-engineer` | Build sub-circuit: Nullifier computation (hash of nullifierSeed + photo bytes) | `packages/circuits/lib/nullifier.circom` |
| 6 | `circom-circuit-engineer` | Build sub-circuit: IST to UNIX UTC timestamp converter | `packages/circuits/lib/timestamp_converter.circom` |
| 7 | `circom-circuit-engineer` | Build main circuit: `aadhaar-verifier.circom` composing all sub-circuits, with signal binding | `packages/circuits/aadhaar-verifier.circom` |
| 8 | `circom-circuit-engineer` | Trusted setup scripts (download ptau, compile, generate zkey, export verification key) | `packages/circuits/scripts/` |
| 9 | `circom-circuit-engineer` | Circuit unit tests with sample Aadhaar QR data | `packages/circuits/test/` |

**Checkpoint:** All circuit tests pass. Constraint count documented. Proving time benchmarked.

---

### Phase 3: Contracts + Core SDK

**Goal:** Build the Solidity verifier contracts and the `@anoncitizen/core` TypeScript SDK.

**Skills:** `solidity-contract-engineer` (custom) + `senior-backend` + `api-design-reviewer`

**These run in parallel after Phase 2:**

**Track A — Contracts:**

| Step | Skill | Task | Output |
|------|-------|------|--------|
| A1 | `solidity-contract-engineer` | Export Groth16 verifier from snarkjs, create wrapper contract with nullifier tracking | `packages/contracts/contracts/` |
| A2 | `solidity-contract-engineer` | Hardhat test suite: proof verification, nullifier replay prevention, signal binding | `packages/contracts/test/` |
| A3 | `solidity-contract-engineer` | Deployment scripts + Hardhat config for testnets | `packages/contracts/scripts/` |

**Track B — Core SDK:**

| Step | Skill | Task | Output |
|------|-------|------|--------|
| B1 | `senior-backend` | QR code parsing: extract signed data bytes + RSA signature bytes from Aadhaar secure QR | `packages/core/src/qr-parser.ts` |
| B2 | `senior-backend` | Pre-verification: validate signature outside circuit, fetch UIDAI public key | `packages/core/src/pre-verify.ts` |
| B3 | `senior-backend` | Proof generation: prepare circuit inputs, call snarkjs.groth16.fullProve, return proof + public signals | `packages/core/src/prover.ts` |
| B4 | `senior-backend` | Off-chain verification: call snarkjs.groth16.verify | `packages/core/src/verifier.ts` |
| B5 | `senior-backend` | Signal hashing utility + nullifier seed management | `packages/core/src/utils.ts` |
| B6 | `senior-backend` | Package public API: clean exports, TypeScript types for all inputs/outputs | `packages/core/src/index.ts` |

**After both tracks:**

| Step | Skill | Task | Output |
|------|-------|------|--------|
| C1 | `api-design-reviewer` | Review the public API surface of @anoncitizen/core — naming, types, error handling, developer ergonomics | `docs/phase-outputs/phase-3/api-review.md` |

**Checkpoint:** Core SDK can generate and verify a proof end-to-end. Contract tests pass on Hardhat.

---

### Phase 4: React + React Native SDKs

**Goal:** Build `@anoncitizen/react` and `@anoncitizen/react-native` packages.

**Skills:** `senior-frontend` + `monorepo-navigator`

| Step | Skill | Task | Output |
|------|-------|------|--------|
| 1 | `monorepo-navigator` | Set up package dependencies (react and react-native both depend on core) | Updated workspace config |
| 2 | `senior-frontend` | `@anoncitizen/react`: React hooks (`useAnonCitizen`, `useProofGeneration`, `useVerification`), QR scanner component via webcam, proof status UI component | `packages/react/src/` |
| 3 | `senior-frontend` | `@anoncitizen/react-native`: Expo-compatible camera QR scanner, proof generation with native threading, mobile-optimized components | `packages/react-native/src/` |
| 4 | `senior-frontend` | Shared types package or barrel exports ensuring react and react-native expose consistent APIs | Type alignment across packages |
| 5 | `senior-frontend` | Demo/example app for react (Next.js or Vite) showing full proof flow | `examples/web-demo/` |
| 6 | `senior-frontend` | Demo/example app for react-native (Expo) showing mobile proof flow | `examples/mobile-demo/` |

**Checkpoint:** Demo apps complete full proof-generate-verify cycle.

---

### Phase 5: QA, Security & Code Review

**Goal:** Comprehensive testing, cryptographic security audit, code quality gate.

**Skills:** `senior-qa` + `playwright-pro` + `senior-security` + `code-reviewer`

| Step | Skill | Task | Output |
|------|-------|------|--------|
| 1 | `senior-qa` | Test strategy document covering: circuit tests, SDK unit tests, contract tests, integration tests, E2E tests. Write missing unit tests for core/react/react-native. | `docs/phase-outputs/phase-5/test-strategy.md` + `packages/*/test/` |
| 2 | `playwright-pro` | E2E tests for the web demo app: QR upload → proof generation → verification display | `tests/e2e/` |
| 3 | `senior-security` | **Cryptographic audit**: RSA implementation correctness, SHA-256 collision resistance in-circuit, nullifier uniqueness guarantees, signalHash binding security, front-running resistance. **Protocol audit**: selective disclosure leaks, timestamp manipulation, QR replay attacks. | `docs/phase-outputs/phase-5/security-audit.md` |
| 4 | `senior-security` | **Contract security audit**: reentrancy, nullifier double-spend, gas griefing, access control, upgrade safety | `docs/phase-outputs/phase-5/contract-security-audit.md` |
| 5 | `code-reviewer` | Full monorepo code review: TypeScript strictness, error handling, dependency hygiene, bundle size impact for React/RN packages | `docs/phase-outputs/phase-5/code-review.md` |

**Gate:** All critical/high findings resolved. Test coverage thresholds met.

---

### Phase 6: CI/CD & npm Publishing

**Goal:** Automated pipeline for testing, building, and publishing all 4 packages to npm.

**Skills:** `ci-cd-pipeline-builder` + `release-manager` + `senior-devops`

| Step | Skill | Task | Output |
|------|-------|------|--------|
| 1 | `ci-cd-pipeline-builder` | GitHub Actions workflows: lint → circuit compile → contract test → SDK test → E2E test. Separate workflows for PR checks vs release publish. | `.github/workflows/` |
| 2 | `release-manager` | Changesets or Lerna config for monorepo versioning. npm publish pipeline for all 4 scoped packages. Changelog generation. | `CHANGELOG.md` + release configs |
| 3 | `senior-devops` | Secrets management (npm tokens, RPC URLs for contract deployment), environment configs for testnet/mainnet | `.github/workflows/` secrets + `infra/` |
| 4 | `release-manager` | npm package.json setup for all 4 packages: proper main/module/types/exports fields, peer dependencies, publish config | `packages/*/package.json` |

**Final checkpoint:** Push to main triggers full CI. Tag a release triggers npm publish of all 4 packages.

---

## Implementation Steps

### Step 1: Create the Project and Directory Structure

```bash
mkdir -p anoncitizen
cd anoncitizen
git init

# Core structure
mkdir -p .claude/commands
mkdir -p .claude/skills/circom-circuit-engineer/references
mkdir -p .claude/skills/solidity-contract-engineer/references
mkdir -p docs/phase-outputs/phase-{1,2,3,4,5,6}
mkdir -p packages/{circuits,core,react,react-native,contracts}
mkdir -p packages/circuits/{lib,scripts,test}
mkdir -p packages/core/{src,test}
mkdir -p packages/react/{src,test}
mkdir -p packages/react-native/{src,test}
mkdir -p packages/contracts/{contracts,test,scripts}
mkdir -p examples/{web-demo,mobile-demo}
mkdir -p tests/e2e
```

### Step 2: Install Marketplace Skills

```
# In Claude Code:
/plugin marketplace add alirezarezvani/claude-skills

# Core engineering
/plugin install engineering-skills@claude-code-skills

# POWERFUL tier (for monorepo-navigator, ci-cd-pipeline-builder, release-manager, api-design-reviewer)
/plugin install engineering-advanced-skills@claude-code-skills

# Product (for agile-product-owner)
/plugin install product-skills@claude-code-skills
```

### Step 3: Create the Two Custom Skills

Copy the `circom-circuit-engineer` and `solidity-contract-engineer` SKILL.md content from the skill definitions above into:

```
.claude/skills/circom-circuit-engineer/SKILL.md
.claude/skills/solidity-contract-engineer/SKILL.md
```

Then populate the reference files. For example:

**`.claude/skills/circom-circuit-engineer/references/aadhaar_qr_spec.md`**
— Document the Aadhaar secure QR code data format: byte layout of signed data, signature format, photo byte offset, field positions for name/DOB/gender/address/pincode, UIDAI public key format.

**`.claude/skills/circom-circuit-engineer/references/circom_syntax.md`**
— Circom 2.x quick reference: template syntax, signal types (input/output), component instantiation, `<==` vs `<--` vs `===`, pragma circom version, include syntax.

**`.claude/skills/circom-circuit-engineer/references/zk_snark_patterns.md`**
— Common patterns: Poseidon hash in-circuit, RSA verification via BigInt chunking, SHA-256 with circomlib, conditional reveal pattern (`signal * selector`), nullifier schemes.

**`.claude/skills/solidity-contract-engineer/references/verifier_patterns.md`**
— snarkjs Groth16 verifier export, calldata formatting, pairing precompile usage, gas optimization for on-chain verification.

### Step 4: Create CLAUDE.md

Create `CLAUDE.md` (or `.claude/CLAUDE.md`) in project root:

```markdown
# AnonCitizen

## Project
Privacy-preserving ZK proof protocol for Aadhaar identity verification.
Uses Circom circuits + snarkjs for proof generation, Solidity for on-chain
verification, TypeScript SDKs for developer integration.

## Packages
- `packages/circuits/` — Circom circuits (aadhaar-verifier + sub-circuits)
- `packages/core/` — @anoncitizen/core (TypeScript, proof gen + verify)
- `packages/react/` — @anoncitizen/react (React hooks + components)
- `packages/react-native/` — @anoncitizen/react-native (Expo compatible)
- `packages/contracts/` — @anoncitizen/contracts (Solidity, Hardhat)

## Tech Stack
- Circom 2.x + snarkjs (Groth16)
- TypeScript (strict mode)
- React 19+ / React Native with Expo
- Solidity 0.8.x + Hardhat
- pnpm workspaces + Turborepo

## Conventions
- All phase outputs → docs/phase-outputs/phase-N/
- Circuit sub-components → packages/circuits/lib/
- Never proceed to next phase without human checkpoint
- All packages use @anoncitizen/ npm scope
- Constraint count must be documented for every circuit change
- Gas benchmarks must be documented for contract changes

## Active Phase
Phase: 1

## Key References
- docs/requirements.md — project plan
- docs/proving_flow.png — circuit architecture diagram
- .claude/skills/circom-circuit-engineer/ — ZK circuit patterns
- .claude/skills/solidity-contract-engineer/ — Solidity patterns
```

### Step 5: Create Phase Command Files

Copy each phase command from the orchestration section above into `.claude/commands/`:

- `.claude/commands/phase-1-plan.md`
- `.claude/commands/phase-2-circuits.md`
- `.claude/commands/phase-3-contracts-core.md`
- `.claude/commands/phase-4-sdks.md`
- `.claude/commands/phase-5-qa-security.md`
- `.claude/commands/phase-6-cicd-publish.md`

Each file should have the `---` frontmatter with name and description, followed by the step-by-step instructions for that phase (mirroring the phase tables above).

### Step 6: Place Your Requirements Doc

```bash
cp your-requirements.md anoncitizen/docs/requirements.md
cp proving_flow.png anoncitizen/docs/proving_flow.png
```

### Step 7: Run

```bash
cd anoncitizen
claude  # opens Claude Code

# Start the orchestration:
> /phase-1-plan

# Review, iterate, approve, then:
> /phase-2-circuits

# And so on...
```

---

## Phase Dependency Graph

```
Phase 1 (Plan)
    │
    ▼
Phase 2 (Circuits)
    │
    ├──────────────┐
    ▼              ▼
Phase 3A         Phase 3B
(Contracts)      (Core SDK)
    │              │
    └──────┬───────┘
           ▼
    Phase 4 (React + RN SDKs)
           │
           ▼
    Phase 5 (QA + Security)
           │
           ▼
    Phase 6 (CI/CD + Publish)
```

Phases 3A and 3B are parallelizable — contracts and core SDK can be built simultaneously once the circuits are done.

---

## Summary of All Skills Used

**Marketplace skills (14):**
`senior-architect`, `agile-product-owner`, `senior-backend`, `senior-frontend`, `senior-security`, `senior-qa`, `playwright-pro`, `code-reviewer`, `monorepo-navigator`, `ci-cd-pipeline-builder`, `release-manager`, `senior-devops`, `api-design-reviewer`, `database-schema-designer`

**Custom skills to create (2):**
`circom-circuit-engineer`, `solidity-contract-engineer`

**Total: 16 skills across 6 phases.**
