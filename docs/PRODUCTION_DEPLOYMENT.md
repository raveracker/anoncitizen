# Production Deployment Guide

## Overview

AnonCitizen production deployment involves four stages:

1. **Circuit artifacts** — Trusted setup ceremony + host WASM/zkey on CDN
2. **Smart contracts** — Deploy to Polygon mainnet + verify on Polygonscan
3. **npm packages** — Publish `@anoncitizen/core`, `@anoncitizen/react`, `@anoncitizen/contracts`
4. **Proving server** — Node.js server with rapidsnark for proof generation

---

## Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Node.js | >= 18 | Build + deploy |
| pnpm | 10+ | Package manager |
| circom | 2.x | Circuit compilation |
| snarkjs | 0.7+ | Trusted setup + key export |
| rapidsnark | 0.0.8+ | Fast proof generation |
| Hardhat | (via devDependencies) | Contract deployment |

### Server Requirements (Proving Server)

| Resource | Minimum | Recommended |
|---|---|---|
| RAM | 2 GB | 4 GB |
| Disk | 2 GB (zkey + wasm) | 5 GB |
| CPU | 2 cores | 4+ cores |
| Node.js heap | `--max-old-space-size=4096` | `--max-old-space-size=8192` |

---

## Stage 1: Circuit Artifacts

### 1.1 Compile the Circuit

```bash
cd packages/circuits
bash scripts/compile.sh
```

Produces:
- `artifacts/aadhaar-verifier.wasm` (~9.5 MB)
- `build/aadhaar-verifier.r1cs` (constraint system)

Current circuit parameters:
- `maxDataBytes = 1280` (supports Aadhaar QR payloads up to ~1.2 KB signed data)
- `n = 121, k = 17` (RSA-2048 via @zk-email/circuits)
- `maxPhotoBytes = 64` (nullifier entropy)
- **Constraints: ~1.46M**

### 1.2 Trusted Setup Ceremony

The Groth16 proving system requires a trusted setup. For production, run a **multi-party ceremony** to eliminate single-party trust.

#### Download Powers of Tau

```bash
PTAU_SIZE=23 bash scripts/setup.sh
```

This downloads `powersOfTau28_hez_final_23.ptau` (~9 GB) from the Hermez ceremony and generates an initial zkey.

#### Multi-Party Ceremony (Recommended)

Each participant contributes randomness. As long as **one** participant is honest, the setup is secure.

```bash
# Participant 1
snarkjs zkey contribute build/aadhaar-verifier_0000.zkey build/aadhaar-verifier_0001.zkey \
  --name="Participant 1" -v

# Participant 2
snarkjs zkey contribute build/aadhaar-verifier_0001.zkey build/aadhaar-verifier_0002.zkey \
  --name="Participant 2" -v

# Repeat for each participant...

# Final: apply a random beacon (e.g., a future Bitcoin block hash)
snarkjs zkey beacon build/aadhaar-verifier_NNNN.zkey build/aadhaar-verifier_final.zkey \
  <random-hex-beacon> 10 --name="Final beacon"

# Verify the final zkey against the circuit and ptau
snarkjs zkey verify build/aadhaar-verifier.r1cs build/powersOfTau28_hez_final_23.ptau \
  build/aadhaar-verifier_final.zkey
```

Record the SHA-256 hash for auditability:
```bash
shasum -a 256 build/aadhaar-verifier_final.zkey
```

#### Export Production Artifacts

```bash
# Verification key (for off-chain verification)
snarkjs zkey export verificationkey \
  build/aadhaar-verifier_final.zkey \
  artifacts/verification_key.json

# Solidity verifier (for on-chain verification)
snarkjs zkey export solidityverifier \
  build/aadhaar-verifier_final.zkey \
  artifacts/Groth16Verifier.sol

# Copy final zkey
cp build/aadhaar-verifier_final.zkey artifacts/aadhaar-verifier.zkey
```

### 1.3 Host Circuit Artifacts

Upload to a CDN or IPFS:

| File | Size | Purpose |
|---|---|---|
| `aadhaar-verifier.wasm` | ~9.5 MB | Witness generation |
| `aadhaar-verifier.zkey` | ~880 MB | Proving key (server-side only) |
| `verification_key.json` | ~8 KB | Off-chain proof verification |

```bash
# Example: upload to AWS S3
aws s3 cp artifacts/aadhaar-verifier.wasm s3://your-bucket/circuits/
aws s3 cp artifacts/aadhaar-verifier.zkey s3://your-bucket/circuits/
aws s3 cp artifacts/verification_key.json s3://your-bucket/circuits/
```

> The zkey (880 MB) is only needed server-side for proof generation. Only the verification key (8 KB) needs to be accessible to clients.

---

## Stage 2: Smart Contract Deployment

### 2.1 Regenerate Solidity Verifier

After the trusted setup, copy the generated `Groth16Verifier.sol` to the contracts package:

```bash
cp packages/circuits/artifacts/Groth16Verifier.sol packages/contracts/contracts/

# Rebuild and test contracts
cd packages/contracts
pnpm build
pnpm test
```

### 2.2 Configure Environment

Create or update `.env` in the project root:

```env
# Polygon Mainnet
POLYGON_RPC_URL=https://polygon-rpc.com
DEPLOYER_PRIVATE_KEY=<your-64-char-hex-private-key>
POLYGONSCAN_API_KEY=<your-polygonscan-api-key>
```

**RPC Providers:**
- [Alchemy](https://alchemy.com) — Recommended for production (free tier available)
- [Ankr](https://rpc.ankr.com/polygon) — Free public RPC
- [QuickNode](https://quicknode.com) — Enterprise-grade

**Getting a Deployer Private Key:**
1. Open MetaMask → Account Details → Show Private Key
2. Ensure the wallet has MATIC for gas fees on Polygon mainnet

**Getting a Polygonscan API Key:**
1. Go to [polygonscan.com](https://polygonscan.com) → My Account → API Keys
2. Create a new key — works for both mainnet and testnet

### 2.3 Add Polygon Mainnet to Hardhat Config

Add a `polygon` network entry in `packages/contracts/hardhat.config.ts`:

```typescript
polygon: {
  url: process.env.POLYGON_RPC_URL || "",
  accounts: process.env.DEPLOYER_PRIVATE_KEY
    ? [process.env.DEPLOYER_PRIVATE_KEY]
    : [],
},
```

### 2.4 Deploy

```bash
cd packages/contracts
npx hardhat run scripts/deploy.ts --network polygon
```

Output:
```
Groth16Verifier: 0x...
AnonCitizen:     0x...
```

### 2.5 Verify on Polygonscan

```bash
npx hardhat verify --network polygon <Groth16Verifier_address>
npx hardhat verify --network polygon <AnonCitizen_address> <Groth16Verifier_address>
```

### 2.6 Register UIDAI Public Key Hash

After deployment, register the UIDAI certificate's public key hash so the contract accepts proofs:

```typescript
import { ethers } from "hardhat";

const anoncitizen = await ethers.getContractAt("AnonCitizen", "<deployed-address>");

// pubKeyHash from a proof's publicSignals[2]
// Generate one proof first to extract this value
await anoncitizen.addTrustedPubKeyHash("<pubKeyHash>");
```

---

## Stage 3: npm Publishing

### 3.1 Version Bump

```bash
pnpm changeset        # Select packages and write changelog
pnpm changeset version # Apply version bumps
```

### 3.2 Build All Packages

```bash
pnpm turbo build
pnpm turbo test        # Verify all 202 tests pass
pnpm turbo typecheck
pnpm turbo lint
```

### 3.3 Publish

**Option A: Manual**
```bash
pnpm --filter @anoncitizen/core publish --access public
pnpm --filter @anoncitizen/react publish --access public
pnpm --filter @anoncitizen/contracts publish --access public
```

**Option B: CI/CD (recommended)**

Push a version tag to trigger the release workflow:
```bash
git add .
git commit -m "chore: release v0.1.0"
git tag v0.1.0
git push origin main --tags
```

The `release.yml` GitHub Action will:
1. Run the full CI pipeline
2. Publish all 3 packages to npm
3. Create a GitHub Release
4. Deploy contracts to Polygon Amoy (testnet, for non-alpha tags)

**Required GitHub Secrets:**
| Secret | Purpose |
|---|---|
| `NPM_TOKEN` | npm publish token |
| `AMOY_RPC_URL` | Polygon Amoy RPC for CI deploy |
| `DEPLOYER_PRIVATE_KEY` | Deployer wallet private key |

---

## Stage 4: Proving Server

Proof generation requires Node.js + rapidsnark (the 880 MB zkey cannot run in browsers).

### 4.1 Install rapidsnark

```bash
# macOS ARM64
curl -L -o rapidsnark.zip https://github.com/iden3/rapidsnark/releases/download/v0.0.8/rapidsnark-macOS-arm64-v0.0.8.zip
unzip rapidsnark.zip -d rapidsnark-bin
cp rapidsnark-bin/*/bin/prover /usr/local/bin/rapidsnark

# Linux x86_64
curl -L -o rapidsnark.zip https://github.com/iden3/rapidsnark/releases/download/v0.0.8/rapidsnark-linux-x86_64-v0.0.8.zip
unzip rapidsnark.zip -d rapidsnark-bin
cp rapidsnark-bin/*/bin/prover /usr/local/bin/rapidsnark
```

### 4.2 Proof Generation Flow

```
Client                            Server
  |                                  |
  |  POST /api/prove                 |
  |  { qrData, nullifierSeed, ... } |
  |  ─────────────────────────────►  |
  |                                  |  1. parseQRCode(qrData)
  |                                  |  2. preVerifySignature()
  |                                  |  3. prepareCircuitInputs()
  |                                  |  4. snarkjs.wtns.calculate() → witness
  |                                  |  5. rapidsnark → proof (~2.7s)
  |                                  |
  |  ◄─────────────────────────────  |
  |  { proof, publicSignals }        |
  |                                  |
  |  Client verifies off-chain       |
  |  (verification_key.json, 8 KB)   |
```

### 4.3 Performance

| Metric | snarkjs (JS) | rapidsnark (C++) |
|---|---|---|
| Witness generation | 2.3s | 2.3s (same) |
| Proof generation | ~50s | **~2.7s** |
| Total | ~52s | **~5s** |
| RAM | ~4 GB | ~2 GB |

### 4.4 Server Script

Use the included test script as a reference:

```bash
cd packages/core
node --max-old-space-size=4096 scripts/test-prove.mjs <qr-image-path> --rapidsnark
```

For a production API server, wrap this in an Express/Fastify endpoint or Next.js Server Action.

---

## Post-Deployment Checklist

- [ ] Multi-party trusted setup ceremony completed
- [ ] Final zkey SHA-256 hash recorded and published
- [ ] Circuit artifacts hosted on CDN (WASM + verification key public, zkey server-only)
- [ ] Groth16Verifier.sol regenerated from production zkey
- [ ] Contracts deployed to Polygon mainnet
- [ ] Contracts verified on Polygonscan
- [ ] UIDAI pubKeyHash registered on-chain
- [ ] npm packages published (`@anoncitizen/core`, `@anoncitizen/react`, `@anoncitizen/contracts`)
- [ ] Proving server deployed with rapidsnark
- [ ] GitHub Secrets configured (`NPM_TOKEN`, `DEPLOYER_PRIVATE_KEY`, RPC URLs)
- [ ] Monitoring/alerting on proving server health
- [ ] UIDAI certificate expiry monitoring (current cert expires 2029-02-03)

---

## Security Considerations

- **Private key management**: Use a hardware wallet or multisig for the contract deployer. Never store mainnet private keys in `.env` on servers.
- **Proving server**: The server sees raw QR data during proof generation. Run it in a trusted environment. Consider TEE (Trusted Execution Environment) for enhanced privacy.
- **Certificate rotation**: The UIDAI Offline eKYC certificate expires 2029-02-03. Plan for certificate updates by registering new pubKeyHashes on-chain.
- **Rate limiting**: Proof generation takes ~5s and ~2 GB RAM per request. Limit concurrent proofs to prevent OOM.
- **zkey integrity**: Verify the zkey hash before deploying. A compromised zkey allows forged proofs.
