# @anoncitizen/react

React hooks and components for AnonCitizen ZK Aadhaar verification.

## Installation

```bash
npm install @anoncitizen/react @anoncitizen/core
```

Requires React 19+.

## Usage

```tsx
import {
  AnonCitizenProvider,
  useAnonCitizen,
  useProofGeneration,
  useVerification,
  QRScanner,
  ProofStatus,
} from "@anoncitizen/react";

function App() {
  return (
    <AnonCitizenProvider
      config={{ wasmUrl: "/circuit.wasm", zkeyUrl: "/circuit.zkey" }}
      publicKey={uidaiPublicKey}
    >
      <VerifyFlow />
    </AnonCitizenProvider>
  );
}

function VerifyFlow() {
  const { isReady } = useAnonCitizen();
  const { status, proof, error, generate } = useProofGeneration();
  const { verifyOffChain, result } = useVerification();

  return (
    <div>
      <QRScanner onScan={(data) =>
        generate({ qrData: data, nullifierSeed: 42n, revealAgeAbove18: true })
      } />
      <ProofStatus status={status} error={error} />
      {proof && <button onClick={() => verifyOffChain(proof)}>Verify</button>}
      {result?.valid && <p>Age above 18: {result.ageAbove18 ? "Yes" : "No"}</p>}
    </div>
  );
}
```

## API

### Provider

- `<AnonCitizenProvider config publicKey?>` — Wraps SDK instance in React context

### Hooks

- `useAnonCitizen()` — Access SDK methods (parseQR, prove, verify, formatForContract)
- `useProofGeneration()` — Managed proof lifecycle (status, proof, error, generate, reset)
- `useVerification()` — Managed verification lifecycle (status, result, error, verifyOffChain, reset)

### Components

- `<QRScanner onScan onError? useCamera? facingMode? width? height?>` — Webcam QR scanner with file upload fallback
- `<ProofStatus status error?>` — Proof generation progress display

## License

MIT
