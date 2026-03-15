# AnonCitizen

Privacy-preserving zero-knowledge proof protocol for Aadhaar identity verification.

Prove ownership of an Aadhaar document without exposing personal information. Verify proofs off-chain or on EVM-compatible blockchains.

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

## Security

This project has undergone internal security review (see `docs/phase-outputs/phase-5/`). The Groth16 verifier requires a trusted setup ceremony before production deployment.

If you discover a vulnerability, please report it responsibly — do not open a public issue.

## License

MIT
