# @anoncitizen/core

Core TypeScript SDK for privacy-preserving Aadhaar identity verification using zero-knowledge proofs.

## Installation

```bash
npm install @anoncitizen/core
```

## Usage

```typescript
import { AnonCitizen } from "@anoncitizen/core";

const ac = new AnonCitizen({
  wasmUrl: "./aadhaar-verifier.wasm",
  zkeyUrl: "./aadhaar-verifier.zkey",
  verificationKey: vkey,
});

// Set UIDAI RSA public key
ac.setPublicKey(uidaiCertPem);

// Parse Aadhaar QR code
const payload = await ac.parseQR(qrData);

// Generate ZK proof with selective disclosure
const proof = await ac.prove({
  qrData,
  nullifierSeed: 42n,
  revealAgeAbove18: true,
  revealGender: false,
  revealState: false,
  revealPinCode: false,
});

// Verify off-chain
const result = await ac.verify(proof);
console.log(result.valid);       // true
console.log(result.ageAbove18);  // true
console.log(result.nullifier);   // BigInt

// Format for on-chain verification
const calldata = ac.formatForContract(proof);
```

## API

### `AnonCitizen` class

- `constructor(config)` — Initialize with WASM/zkey URLs and optional verification key
- `setPublicKey(certOrKey)` — Set UIDAI RSA public key (PEM, DER, or pre-parsed)
- `parseQR(qrData)` — Parse Aadhaar QR code into structured payload
- `prove(request)` — Generate a Groth16 ZK proof
- `verify(proof)` — Verify proof off-chain
- `formatForContract(proof)` — Format proof for Solidity contract call

### Standalone functions

- `parseQRCode(qrData)` — Parse QR without SDK instance
- `generateProof(payload, publicKey, request, wasmPath, zkeyPath)` — Low-level proof generation
- `verifyProofOffChain(proof, verificationKey)` — Low-level verification
- `formatProofForContract(proof)` — Format for on-chain use
- `hashSignal(signal)` — Poseidon hash for signal binding
- `generateNullifierSeed(appId)` — Deterministic nullifier seed from app ID

## Circuit Artifacts

The WASM and zkey files are not bundled with this package. Host them on IPFS or a CDN and provide URLs in the config.

## License

MIT
