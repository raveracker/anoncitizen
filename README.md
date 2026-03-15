# AnonCitizen

Privacy-preserving zero-knowledge proof protocol for Aadhaar identity verification.

Prove ownership of an Aadhaar document without exposing personal information. Verify proofs off-chain or on EVM-compatible blockchains.

## Use Cases

### Financial Services & Fintech
- **KYC without data exposure** — Banks, NBFCs, and lending platforms can verify a customer is a real Aadhaar holder without storing or processing their personal data, reducing compliance burden under DPDPA and RBI guidelines.
- **Credit scoring prerequisites** — Verify age, state, and identity uniqueness before initiating a credit check, without collecting the full Aadhaar number.
- **UPI / payment onboarding** — Prove identity for wallet or payment app registration while keeping personal details private.

### Web3 & DeFi
- **Sybil resistance** — Use the nullifier mechanism to ensure one-person-one-account on DAOs, airdrops, quadratic voting, and DeFi protocols — without linking on-chain identity to a real person.
- **Proof-of-personhood** — Prove you are a unique human for governance, token claims, or reputation systems without revealing who you are.
- **Privacy-preserving KYC for regulated DeFi** — Meet compliance requirements for permissioned DeFi pools while preserving user privacy through selective disclosure.

### Healthcare
- **Patient identity verification** — Verify a patient's identity and state of residence for insurance claims or telemedicine consultations without exposing their full Aadhaar details.
- **Age-gated services** — Prove a patient is above a certain age for consent purposes without revealing their date of birth.

### Government & Public Services
- **Subsidy verification** — Prove eligibility (age, state, PIN code) for government schemes without centralizing personal data.
- **Anonymous feedback systems** — Allow citizens to submit verified feedback on public services while remaining anonymous — the nullifier ensures one submission per person.
- **Election & polling systems** — Verify voter eligibility (age, residency) without creating a linkable identity trail.

### Education & EdTech
- **Exam identity verification** — Verify a student's identity for online examinations without collecting and storing their Aadhaar data.
- **Scholarship eligibility** — Prove age, state, or residency requirements for scholarship applications while keeping personal details private.

### E-Commerce & Marketplaces
- **Age verification** — Prove a buyer is above 18 for age-restricted products without sharing any other personal information.
- **Seller verification** — Verify that marketplace sellers are real individuals with valid identity, without the platform storing their documents.

### Insurance
- **Policy issuance** — Verify identity and age for insurance underwriting without processing full Aadhaar data.
- **Claims verification** — Prove the claimant is the policy holder using ZK proofs instead of document re-submission.

### Human Resources
- **Background verification** — Verify candidate identity during hiring without the employer ever seeing the raw Aadhaar document.
- **Contractor onboarding** — Gig economy platforms can verify worker identity with minimal data collection.

## Packages

| Package | Description | npm |
|---|---|---|
| [`@anoncitizen/core`](./packages/core/) | TypeScript SDK — QR parsing, proof generation, verification | [![npm](https://img.shields.io/npm/v/@anoncitizen/core)](https://www.npmjs.com/package/@anoncitizen/core) |
| [`@anoncitizen/react`](./packages/react/) | React hooks & components | [![npm](https://img.shields.io/npm/v/@anoncitizen/react)](https://www.npmjs.com/package/@anoncitizen/react) |
| [`@anoncitizen/contracts`](./packages/contracts/) | Solidity verifier + nullifier tracking | [![npm](https://img.shields.io/npm/v/@anoncitizen/contracts)](https://www.npmjs.com/package/@anoncitizen/contracts) |

## Quick Start

### Web (React)

```bash
npm install @anoncitizen/react
```

```tsx
import {
  AnonCitizenProvider,
  useAnonCitizen,
  useProofGeneration,
  QRScanner,
} from "@anoncitizen/react";

function App() {
  return (
    <AnonCitizenProvider
      config={{ wasmUrl: "/circuit.wasm", zkeyUrl: "/circuit.zkey" }}
      publicKey={uidaiPublicKey}
    >
      <ProofFlow />
    </AnonCitizenProvider>
  );
}

function ProofFlow() {
  const { isReady } = useAnonCitizen();
  const { status, proof, generate } = useProofGeneration();

  return (
    <>
      <QRScanner onScan={(data) =>
        generate({ qrData: data, nullifierSeed: 42n, revealAgeAbove18: true })
      } />
      {status === "complete" && <p>Proof generated!</p>}
    </>
  );
}
```

### Node.js / Standalone

```bash
npm install @anoncitizen/core
```

```typescript
import { AnonCitizen } from "@anoncitizen/core";

const ac = new AnonCitizen({
  wasmUrl: "./circuit.wasm",
  zkeyUrl: "./circuit.zkey",
  verificationKey: vkey,
});
ac.setPublicKey(uidaiCertPem);

// Parse QR → Generate proof → Verify
const payload = await ac.parseQR(qrData);
const proof = await ac.prove({
  qrData,
  nullifierSeed: 42n,
  revealAgeAbove18: true,
});
const result = await ac.verify(proof);
console.log(result.valid, result.ageAbove18);
```

### On-Chain Verification

```bash
npm install @anoncitizen/contracts
```

```solidity
import { AnonCitizen } from "@anoncitizen/contracts/contracts/AnonCitizen.sol";

// Deploy: Groth16Verifier → AnonCitizen(verifierAddress)
// Then call: anoncitizen.verifyAndRecord(pA, pB, pC, pubSignals)
```

## How It Works

1. **Scan** — Read the Aadhaar secure QR code
2. **Parse** — Extract signed data, RSA signature, and identity fields
3. **Prove** — Generate a Groth16 ZK proof inside a Circom circuit:
   - SHA-256 hash of signed data
   - RSA signature verification against UIDAI public key
   - Selective field disclosure (age > 18, gender, state, pincode)
   - Nullifier computation (prevents replay without revealing identity)
   - Timestamp conversion (IST → UTC)
   - Signal binding (anti-front-running)
4. **Verify** — Check the proof off-chain (snarkjs) or on-chain (Solidity)

## Architecture

```
QR Code → @anoncitizen/core → Circom Circuit → Groth16 Proof
                           ↓
Off-chain verify (snarkjs) ← @anoncitizen/react
On-chain verify (Solidity) ← @anoncitizen/contracts
```

## Development

```bash
# Prerequisites: Node.js >= 18, pnpm 10+
pnpm install
pnpm turbo build
pnpm turbo test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup details.

## Publishing a New Version

```bash
# 1. Create a changeset (select packages + describe changes)
pnpm changeset

# 2. Apply version bumps to package.json files
pnpm run version:bump

# 3. Commit the version bumps and changelogs
git add .
git commit -m "chore: release v0.x.0"

# 4. Tag and push — triggers the full release pipeline
git tag v0.x.0
git push origin main --tags
```

The release pipeline runs automatically on tag push:

1. **CI** — lint, typecheck, test all packages (202 tests)
2. **Deploy** — deploy contracts to Polygon Amoy testnet
3. **Publish** — publish `@anoncitizen/core`, `@anoncitizen/react`, `@anoncitizen/contracts` to npm
4. **Release** — create a GitHub Release with auto-generated notes

## Roadmap

### SDK & Language Support

| Language | Package | Status |
|---|---|---|
| TypeScript/JavaScript | `@anoncitizen/core` | Available |
| React | `@anoncitizen/react` | Available |
| Python | `@anoncitizen/python` | Planned |
| Rust | `@anoncitizen/rust` | Planned |
| Go | `@anoncitizen/go` | Planned |

### Mobile SDKs

| Platform | Package | Status |
|---|---|---|
| React Native | `@anoncitizen/react-native` | Planned |
| Flutter | `anoncitizen_flutter` | Planned |
| Android (Kotlin) | `anoncitizen-android` | Planned |
| iOS (Swift) | `AnonCitizen` | Planned |

### REST API

A self-hosted API server for proof generation and verification — no SDK integration required.

```
POST /api/prove     — Generate a ZK proof from QR data
POST /api/verify    — Verify a proof off-chain
GET  /api/health    — Server health + circuit artifact status
```

Planned features:
- Docker image with rapidsnark for fast proof generation (~3s)
- API key authentication
- Rate limiting and request queuing
- Webhook callbacks for async proof generation
- OpenAPI/Swagger documentation

## Security

This project has undergone internal security review (see [SECURITY_AUDIT.md](./SECURITY_AUDIT.md). The Groth16 verifier requires a trusted setup ceremony before production deployment.

If you discover a vulnerability, please report it responsibly — do not open a public issue.

## License

MIT
