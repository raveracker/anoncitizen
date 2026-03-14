# Phase 1 — System Architecture

## 1. Monorepo Structure & Package Boundaries

```
anoncitizen/
├── packages/
│   ├── circuits/          # Circom 2.x circuits (no npm publish — artifacts distributed)
│   ├── core/              # @anoncitizen/core — TypeScript SDK
│   ├── contracts/         # @anoncitizen/contracts — Solidity + Hardhat
│   ├── react/             # @anoncitizen/react — React 19+ hooks & components
│   └── react-native/     # @anoncitizen/react-native — Expo-compatible SDK
├── examples/
│   ├── web-demo/          # Vite + React demo app
│   └── mobile-demo/       # Expo demo app
├── docs/
├── package.json           # Workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

### Package Responsibilities

| Package | Scope | Runtime | Published to npm? |
|---------|-------|---------|-------------------|
| `circuits` | Circom circuit source, compilation scripts, trusted setup, test vectors | Node.js (build-time only) | No — artifacts (wasm, zkey, vkey) are bundled into `core` |
| `core` | QR parsing, circuit input preparation, proof generation (snarkjs), off-chain verification, types | Node.js / Browser | Yes — `@anoncitizen/core` |
| `contracts` | Groth16 verifier (auto-generated), AnonCitizen wrapper contract, nullifier registry, deploy scripts | EVM (Solidity) | Yes — `@anoncitizen/contracts` (ABI + typechain) |
| `react` | React hooks (`useAnonCitizen`, `useProofGeneration`, `useVerification`), QR scanner component (webcam) | Browser | Yes — `@anoncitizen/react` |
| `react-native` | Expo camera QR scanner, native-threaded proof generation, mobile-optimized components | React Native / Expo | Yes — `@anoncitizen/react-native` |

---

## 2. Package Dependency Graph

```
circuits (build-time artifact producer)
    │
    ├──→ core (embeds circuit artifacts: .wasm, .zkey, verification_key.json)
    │       │
    │       ├──→ react (peer-depends on core + react)
    │       │
    │       └──→ react-native (peer-depends on core + react-native + expo)
    │
    └──→ contracts (snarkjs exports Groth16 verifier.sol from circuit's zkey)
```

### Dependency Rules

| Package | Direct Dependencies | Peer Dependencies |
|---------|-------------------|-------------------|
| `circuits` | `circomlib`, `snarkjs` (dev) | — |
| `core` | `snarkjs`, `pako` (for QR decompression), `@noble/hashes` (SHA-256 outside circuit) | — |
| `contracts` | `@openzeppelin/contracts` | — |
| `react` | `@anoncitizen/core` | `react` ≥ 19 |
| `react-native` | `@anoncitizen/core` | `react-native`, `expo`, `expo-camera` |

### Build Order (Turborepo pipeline)

```
circuits:build → core:build → [react:build, react-native:build] (parallel)
circuits:build → contracts:build (independent track)
```

---

## 3. Data Flow

### End-to-End: QR Code → Verified Proof

```
┌─────────────────────────────────────────────────────────────────────┐
│ CLIENT (Browser or Mobile)                                          │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐    │
│  │ QR Scanner   │───→│ QR Parser    │───→│ Input Preparation  │    │
│  │ (react /     │    │ (core)       │    │ (core)             │    │
│  │  react-      │    │              │    │                    │    │
│  │  native)     │    │ Extracts:    │    │ Formats:           │    │
│  │              │    │ - signedData │    │ - Pad/chunk for    │    │
│  │ Scans or     │    │ - signature  │    │   SHA-256          │    │
│  │ uploads QR   │    │ - photo      │    │ - BigInt chunks    │    │
│  │ image        │    │   bytes      │    │   for RSA          │    │
│  └──────────────┘    └──────────────┘    │ - Field offsets    │    │
│                                           └────────┬───────────┘    │
│                                                    │                │
│                                                    ▼                │
│                                           ┌────────────────────┐    │
│                                           │ Proof Generation   │    │
│                                           │ (core + snarkjs)   │    │
│                                           │                    │    │
│                                           │ snarkjs.groth16    │    │
│                                           │   .fullProve(      │    │
│                                           │     inputs,        │    │
│                                           │     circuit.wasm,  │    │
│                                           │     circuit.zkey   │    │
│                                           │   )                │    │
│                                           │                    │    │
│                                           │ Returns:           │    │
│                                           │ { proof,           │    │
│                                           │   publicSignals }  │    │
│                                           └────────┬───────────┘    │
│                                                    │                │
└────────────────────────────────────────────────────┼────────────────┘
                                                     │
                          ┌──────────────────────────┼──────────────────┐
                          │                          │                  │
                          ▼                          ▼                  │
                 ┌────────────────┐        ┌──────────────────┐        │
                 │ OFF-CHAIN      │        │ ON-CHAIN         │        │
                 │ Verification   │        │ Verification     │        │
                 │ (core)         │        │ (contracts)      │        │
                 │                │        │                  │        │
                 │ snarkjs.       │        │ AnonCitizen.sol  │        │
                 │  groth16.      │        │  .verifyProof(   │        │
                 │  verify(       │        │    proof,         │        │
                 │    vkey,       │        │    publicSignals  │        │
                 │    publicSigs, │        │  )               │        │
                 │    proof       │        │                  │        │
                 │  )             │        │ - Verifies proof │        │
                 │                │        │ - Checks nullifier│       │
                 │ Returns: bool  │        │ - Emits event    │        │
                 └────────────────┘        └──────────────────┘        │
                                                                       │
```

### QR Data Extraction Detail

The Aadhaar secure QR code contains a compressed byte stream:

1. **Decompress** — The QR payload is zlib-compressed. Decompress to get raw bytes.
2. **Parse header** — First bytes indicate version and delimiter positions.
3. **Extract signed data** — All bytes except the last 256 bytes (the RSA signature).
4. **Extract signature** — Last 256 bytes (2048-bit RSA signature).
5. **Parse fields from signed data** — Delimiter-separated fields containing: reference ID, name, DOB, gender, address (care of, district, landmark, house, location, pincode, post office, state, street, sub-district, VTC), mobile hash, email hash, photo bytes.

---

## 4. Interface Contracts Between Packages

### circuits → core (Build Artifacts)

The `circuits` package produces three artifacts consumed by `core`:

```typescript
// Artifact paths (relative to core package)
const CIRCUIT_WASM = "./artifacts/aadhaar-verifier.wasm";
const CIRCUIT_ZKEY = "./artifacts/aadhaar-verifier.zkey";
const VERIFICATION_KEY = "./artifacts/verification_key.json";
```

These are copied into `core`'s build output during the Turborepo pipeline via a post-build script in `circuits`.

### circuits → contracts (Verifier Contract)

snarkjs exports a Solidity verifier from the circuit's zkey:

```bash
snarkjs zkey export solidityverifier circuit.zkey Groth16Verifier.sol
```

This is committed to `packages/contracts/contracts/Groth16Verifier.sol` and wrapped by `AnonCitizen.sol`.

### core → react / react-native (Public API)

```typescript
// @anoncitizen/core — Public API surface

// Types
export interface AnonCitizenProof {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
}

export interface ProofRequest {
  qrData: Uint8Array;             // Raw QR code bytes (or decompressed)
  signal?: string;                 // Optional signal to bind (default: "1")
  nullifierSeed: bigint;           // Application-specific nullifier seed
  revealAgeAbove18?: boolean;      // Default: false
  revealGender?: boolean;          // Default: false
  revealState?: boolean;           // Default: false
  revealPinCode?: boolean;         // Default: false
}

export interface VerificationResult {
  valid: boolean;
  nullifier: bigint;
  timestamp: number;               // UNIX UTC
  pubKeyHash: bigint;
  signalHash: bigint;
  nullifierSeed: bigint;
  // Conditionally present:
  ageAbove18?: boolean;
  gender?: string;
  state?: string;
  pinCode?: string;
}

// Functions
export function parseQRCode(imageData: Uint8Array): Promise<QRPayload>;
export function generateProof(request: ProofRequest): Promise<AnonCitizenProof>;
export function verifyProofOffChain(proof: AnonCitizenProof): Promise<VerificationResult>;
export function formatProofForContract(proof: AnonCitizenProof): ContractCalldata;
```

### contracts — Public Interface

```solidity
// AnonCitizen.sol
interface IAnonCitizen {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[] calldata _pubSignals
    ) external returns (bool);

    function isNullifierUsed(uint256 nullifier) external view returns (bool);

    event ProofVerified(
        uint256 indexed nullifier,
        uint256 signalHash,
        uint256 timestamp
    );
}
```

---

## 5. Trusted Setup Ceremony

### Flow

```
Phase 1 (Powers of Tau) — Universal, reusable
    │
    ▼
Download existing ptau file from Hermez ceremony
(powersOfTau28_hez_final_XX.ptau — XX based on constraint count)
    │
    ▼
Phase 2 (Circuit-specific)
    │
    ├── snarkjs groth16 setup circuit.r1cs ptau circuit_0000.zkey
    ├── snarkjs zkey contribute circuit_0000.zkey circuit_0001.zkey
    │   (repeat for multiple contributors if desired)
    ├── snarkjs zkey beacon circuit_000N.zkey circuit_final.zkey
    └── snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
```

### Artifact Distribution Strategy

| Artifact | Size (estimated) | Distribution |
|----------|-----------------|--------------|
| `aadhaar-verifier.wasm` | ~2-5 MB | Bundled in `@anoncitizen/core` npm package |
| `aadhaar-verifier.zkey` | ~50-200 MB | **NOT bundled** — hosted on CDN/IPFS, fetched at runtime |
| `verification_key.json` | ~2 KB | Bundled in `@anoncitizen/core` |
| `Groth16Verifier.sol` | ~15 KB | Committed to `packages/contracts/` |

The zkey is too large for npm. `core` will provide a `fetchZKey(url)` utility and a default CDN URL, with the option for developers to self-host.

### Decision: ADR-001 — zkey Distribution

The zkey file will be fetched from a configurable URL at runtime rather than bundled. This keeps the npm package small and allows key rotation without re-publishing. The default URL will point to an IPFS-pinned copy with a content-hash integrity check.

---

## 6. Build Orchestration

### Decision: pnpm + Turborepo

| Criteria | pnpm | yarn | Decision |
|----------|------|------|----------|
| Disk efficiency | Hardlinks, best-in-class | PnP is fast but complex | **pnpm** |
| Workspace protocol | `workspace:*` — clean | Similar | Tie |
| Lockfile reliability | Deterministic, fast | Reliable | Tie |
| Ecosystem adoption for crypto projects | Widely used (snarkjs, circomlib) | Also used | Slight pnpm edge |
| Strictness (phantom deps) | Strict by default — prevents accidental imports | Less strict | **pnpm** |

| Criteria | Turborepo | Nx | Decision |
|----------|-----------|-----|----------|
| Setup complexity | Minimal — single `turbo.json` | Heavier — plugin system, project.json per package | **Turborepo** |
| Cache | Local + remote (Vercel) | Local + Nx Cloud | Tie |
| Overhead for 5 packages | Negligible | Overkill | **Turborepo** |
| Circom circuit compilation | Just runs the script — no special support needed | Same | Tie |

**Justification:** pnpm + Turborepo is the lighter-weight choice for a 5-package monorepo. Nx provides more features (affected graph, code generation) but adds complexity we don't need. pnpm's strict dependency resolution prevents phantom dependency issues that could be painful when multiple packages share snarkjs.

### turbo.json Pipeline

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "artifacts/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

### Build dependency resolution:

1. `circuits:build` — Compiles Circom → produces .wasm, .zkey, .vkey, Verifier.sol
2. `core:build` — Copies circuit artifacts, compiles TypeScript
3. `contracts:build` — Copies Verifier.sol, compiles Solidity via Hardhat
4. `react:build` — Compiles TypeScript (depends on core types)
5. `react-native:build` — Compiles TypeScript (depends on core types)

Steps 4 and 5 run in parallel. Steps 2 and 3 can also run in parallel since they depend only on `circuits`.

---

## 7. Security Architecture

### Threat Model Summary

| Threat | Mitigation |
|--------|-----------|
| Forged Aadhaar document | RSA signature verification inside circuit against UIDAI public key |
| Identity re-use / replay | Nullifier = Poseidon(nullifierSeed, photoHash) — unique per app + user |
| Front-running on-chain | signalHash binding — proof is bound to a specific transaction signal |
| Selective disclosure leak | Conditional reveal pattern: output = value * selector (0 or 1) |
| Timestamp manipulation | IST→UTC conversion inside circuit; timestamp from signed data, not user input |
| QR code replay across apps | Different nullifierSeed per application produces different nullifiers |
| UIDAI key rotation | pubKeyHash output allows verifiers to maintain a registry of valid keys |

### Key Management

- **UIDAI RSA Public Key**: Hardcoded in the SDK with a mechanism to update. The `pubKeyHash` output allows verifiers to check the proof was generated against a known-good key.
- **Nullifier Seed**: Application-provided. Each application should use a unique, deterministic seed (e.g., derived from their domain or contract address).
- **Signal Hash**: Application-provided. Defaults to hash("1"). Used to bind the proof to a specific action (e.g., a vote, a transaction).

---

## 8. Open Architecture Decisions

| ID | Question | Options | Recommendation | Status |
|----|----------|---------|----------------|--------|
| ADR-001 | zkey distribution | npm bundle vs CDN/IPFS | CDN/IPFS with integrity check | **Decided** |
| ADR-002 | Nullifier hash function | Poseidon vs SHA-256 in-circuit | Poseidon (far fewer constraints) | **Decided** |
| ADR-003 | RSA implementation | circom-rsa-verify lib vs custom | Use existing `circom-rsa-verify` from PSE/anon-aadhaar | Pending review |
| ADR-004 | SHA-256 implementation | circomlib sha256 vs custom | circomlib `Sha256` template | Pending review |
| ADR-005 | Photo bytes for nullifier | Full photo vs photo hash | Hash of photo bytes (reduces circuit input size) | Pending review |
| ADR-006 | React Native proving | In-app WASM vs native module | WASM via hermes/JSI — benchmark in Phase 4 | Deferred |
