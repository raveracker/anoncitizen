# Local Testing Guide

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | >= 18 | `node -v` |
| pnpm | 10+ | `pnpm -v` |
| circom | 2.x | `circom --version` |
| snarkjs | 0.7+ | `npx snarkjs --version` |
| rapidsnark | 0.0.8+ | `rapidsnark` (optional, for fast proofs) |

### Installing circom

```bash
# macOS (Homebrew)
brew install circom

# Linux (prebuilt binary)
curl -L https://github.com/iden3/circom/releases/latest/download/circom-linux-amd64 -o /usr/local/bin/circom
chmod +x /usr/local/bin/circom

# From source (Rust required)
git clone https://github.com/nicpolkern/circom.git
cd circom && cargo build --release
cp target/release/circom /usr/local/bin/
```

### Installing snarkjs

```bash
npm install -g snarkjs
```

---

## Initial Setup

```bash
git clone https://github.com/anoncitizen/anoncitizen.git
cd anoncitizen
pnpm install
```

---

## 1. Circuits (`packages/circuits/`)

### Compile

```bash
cd packages/circuits
bash scripts/compile.sh
```

This produces:
- `build/aadhaar-verifier.r1cs` — constraint system
- `build/aadhaar-verifier_js/aadhaar-verifier.wasm` — witness generator
- `artifacts/aadhaar-verifier.wasm` — copy for SDK consumption

### Trusted Setup (dev)

```bash
bash scripts/setup.sh
```

This downloads Powers of Tau (2^20, ~300 MB), generates a zkey, and exports:
- `artifacts/verification_key.json`
- `artifacts/Groth16Verifier.sol`

For production use 2^23:
```bash
PTAU_SIZE=23 bash scripts/setup.sh
```

### Run Tests

```bash
pnpm test
```

Tests use `circom_tester` + Mocha. They verify signal correctness, constraint satisfaction, and edge cases. Timeout is 120s per test (circuit operations are slow).

---

## 2. Core SDK (`packages/core/`)

### Build

```bash
cd packages/core
pnpm build
```

Produces `dist/` with ESM, CJS, and `.d.ts` outputs via tsup.

### Run Tests

```bash
pnpm test
```

- **Unit tests** (`test/core.test.ts`) — 146 tests, mocked snarkjs/circomlibjs
- **Integration tests** (`test/integration.test.ts`) — 5 tests, real UIDAI certificate parsing

### Typecheck

```bash
pnpm typecheck
```

### Lint

```bash
pnpm lint
```

---

## 3. Smart Contracts (`packages/contracts/`)

### Compile

```bash
cd packages/contracts
pnpm build
```

Compiles Solidity contracts via Hardhat and generates TypeChain types.

### Run Tests

```bash
pnpm test
```

Tests use Hardhat's local network (no external RPC needed). Covers:
- Valid proof verification
- Nullifier double-spend rejection
- Invalid proof rejection
- Access control
- Gas benchmarks

### Deploy to Local Hardhat Node

Terminal 1:
```bash
npx hardhat node
```

Terminal 2:
```bash
npx hardhat run scripts/deploy.ts --network localhost
```

### Deploy to Polygon Amoy Testnet

#### Getting the RPC URL

The default public RPC is already set in `.env`:
```
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

For more reliable performance, you can use a dedicated RPC provider:
- [Alchemy](https://alchemy.com) — Create a free account, create an app with "Polygon Amoy" network, copy the HTTPS URL
- [Ankr](https://rpc.ankr.com/polygon_amoy) — Free, no signup needed

#### Getting the Deployer Private Key (MetaMask)

1. Open the **MetaMask** browser extension
2. Click the **three dots (...)** next to your account name
3. Select **Account details**
4. Click **Show private key**
5. Enter your MetaMask password to confirm
6. Copy the 64-character hex string
7. Paste it in `.env` as `DEPLOYER_PRIVATE_KEY`

> **Important:** Never share your private key or commit it to git. The `.env` file is already in `.gitignore`.

Make sure this wallet has testnet POL on Amoy. Get free testnet POL from:
- [Polygon Faucet](https://faucet.polygon.technology/) — Select "Amoy" network
- [Alchemy Polygon Faucet](https://www.alchemy.com/faucets/polygon-amoy)

#### Getting a Polygonscan API Key

1. Go to [polygonscan.com](https://polygonscan.com) and create a free account (or log in)
2. Navigate to **My Account** → **API Keys** (or go directly to [polygonscan.com/myapikey](https://polygonscan.com/myapikey))
3. Click **Add** to create a new API key
4. Copy the key and paste it in `.env` as `POLYGONSCAN_API_KEY`

> The same Polygonscan API key works for both Polygon mainnet and Amoy testnet.

#### .env Setup

```
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
DEPLOYER_PRIVATE_KEY=<your-64-char-hex-private-key>
POLYGONSCAN_API_KEY=<your-polygonscan-api-key>
```

#### Deploy

```bash
cd packages/contracts
npx hardhat run scripts/deploy.ts --network amoy
```

#### Verify on Polygonscan

```bash
npx hardhat verify --network amoy <Groth16Verifier_address>
npx hardhat verify --network amoy <AnonCitizen_address> <Groth16Verifier_address>
```

---

## 4. React SDK (`packages/react/`)

### Build

```bash
cd packages/react
pnpm build
```

### Run Tests

```bash
pnpm test
```

Tests use vitest + @testing-library/react. Covers hooks (`useAnonCitizen`, `useProofGeneration`, `useVerification`) and components (`QRScanner`, `ProofStatus`).

---

## 5. Web Demo (`examples/web-demo/`)

### Run Locally

```bash
# Build dependencies first
pnpm turbo build --filter=@anoncitizen/core --filter=@anoncitizen/react

# Start dev server
cd examples/web-demo
pnpm dev
```

Opens at `http://localhost:5173`. Flow: scan QR → select fields → generate proof → verify.

### E2E Tests (Playwright)

```bash
# Install browsers (first time only)
npx playwright install --with-deps chromium

# Run tests (starts web-demo dev server automatically)
npx playwright test --config=tests/e2e/playwright.config.ts --project=chromium
```

---

## Run Everything (from root)

```bash
# Build all packages (respects dependency order)
pnpm turbo build

# Run all tests
pnpm turbo test

# Typecheck all packages
pnpm turbo typecheck

# Lint all packages
pnpm turbo lint
```

---

## Pre-v0.1.0 Blockers

### 1. Trusted Setup Ceremony

The Groth16 proving system requires a trusted setup to generate production proving and verification keys. The current keys are placeholders.

**Steps:**

```bash
cd packages/circuits

# Step 1: Compile the circuit (if not done)
bash scripts/compile.sh

# Step 2: Download production Powers of Tau (2^23, ~1.5 GB)
PTAU_SIZE=23 bash scripts/setup.sh
```

The `setup.sh` script will:
1. Download `powersOfTau28_hez_final_23.ptau` from the Hermez ceremony
2. Run Groth16 Phase 2 setup with the circuit's R1CS
3. Contribute randomness to the Phase 2 ceremony
4. Export `verification_key.json` and `Groth16Verifier.sol`

**For a multi-party ceremony** (recommended for production):
```bash
# Participant 1
snarkjs zkey contribute build/aadhaar-verifier_0000.zkey build/aadhaar-verifier_0001.zkey \
  --name="Participant 1" -v

# Participant 2
snarkjs zkey contribute build/aadhaar-verifier_0001.zkey build/aadhaar-verifier_0002.zkey \
  --name="Participant 2" -v

# ... repeat for each participant

# Final: apply a random beacon
snarkjs zkey beacon build/aadhaar-verifier_NNNN.zkey build/aadhaar-verifier_final.zkey \
  <random-hex-beacon> 10 --name="Final beacon"

# Verify the final zkey
snarkjs zkey verify build/aadhaar-verifier.r1cs build/powersOfTau28_hez_final_23.ptau \
  build/aadhaar-verifier_final.zkey
```

Record the SHA-256 hash of the final zkey for auditability:
```bash
shasum -a 256 build/aadhaar-verifier_final.zkey
```

### 2. Regenerate Groth16Verifier.sol

After the trusted setup, regenerate the Solidity verifier from the production zkey:

```bash
# Export new Solidity verifier
snarkjs zkey export solidityverifier \
  build/aadhaar-verifier_final.zkey \
  ../contracts/contracts/Groth16Verifier.sol

# Export verification key for off-chain verification
snarkjs zkey export verificationkey \
  build/aadhaar-verifier_final.zkey \
  artifacts/verification_key.json
```

Then rebuild and test contracts:
```bash
cd packages/contracts
pnpm build
pnpm test
```

### 3. Register UIDAI Public Key Hash

After deploying the `AnonCitizen` contract, register the real UIDAI public key hash so the contract accepts proofs signed by UIDAI.

**Compute the pubKeyHash off-chain:**

```typescript
import { parseRSAPublicKeyFromCert } from "@anoncitizen/core";
import { readFileSync } from "fs";

const cert = readFileSync("packages/core/assets/uidai-offline-ekyc.cer", "utf8");
const pubKey = parseRSAPublicKeyFromCert(cert);

// The pubKeyHash is computed inside the circuit via Poseidon hash of the 32 modulus limbs.
// To register it, generate a proof with the real key and extract pubSignals[2].
console.log("Modulus limbs:", pubKey.modulusLimbs.map(l => l.toString()));
```

**Register on-chain** (contract owner only):

```typescript
import { ethers } from "hardhat";

const anoncitizen = await ethers.getContractAt("AnonCitizen", "<deployed-address>");

// pubKeyHash from proof generation (pubSignals[2])
await anoncitizen.addTrustedPubKeyHash("<pubKeyHash>");
```

Repeat for each UIDAI certificate you want to support (Secure QR and Offline eKYC have different keys).

### 4. Upload Circuit Artifacts

Host the WASM and zkey files on a CDN or IPFS so SDK consumers can fetch them:

```bash
# Files to upload
packages/circuits/artifacts/aadhaar-verifier.wasm  # ~5-20 MB
packages/circuits/build/aadhaar-verifier_final.zkey # ~50-200 MB
packages/circuits/artifacts/verification_key.json   # ~2 KB
```

SDK consumers reference these URLs:
```typescript
const ac = new AnonCitizen({
  wasmUrl: "https://your-cdn.com/aadhaar-verifier.wasm",
  zkeyUrl: "https://your-cdn.com/aadhaar-verifier_final.zkey",
  verificationKeyUrl: "https://your-cdn.com/verification_key.json",
});
```

---

## Release

Once all blockers are resolved:

```bash
# Version bump via Changesets
pnpm changeset
pnpm changeset version

# Commit and tag
git add .
git commit -m "chore: release v0.1.0"
git tag v0.1.0
git push origin main --tags
```

The `release.yml` GitHub Action will automatically:
1. Run the full CI pipeline
2. Publish all 3 packages to npm
3. Create a GitHub Release
4. Deploy contracts to Polygon Amoy (non-alpha tags)
