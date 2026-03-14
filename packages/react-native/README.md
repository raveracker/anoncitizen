# @anoncitizen/react-native

React Native (Expo) SDK for AnonCitizen ZK Aadhaar verification.

## Installation

```bash
npx expo install @anoncitizen/react-native @anoncitizen/core expo-camera expo-image-picker
```

## Usage

```tsx
import {
  AnonCitizenProvider,
  useProofGeneration,
  CameraQRScanner,
  ImageQRScanner,
  ProofStatus,
} from "@anoncitizen/react-native";

export default function App() {
  return (
    <AnonCitizenProvider
      config={{ wasmUrl: "https://cdn.example.com/circuit.wasm", zkeyUrl: "https://cdn.example.com/circuit.zkey" }}
      publicKey={uidaiPublicKey}
    >
      <VerifyScreen />
    </AnonCitizenProvider>
  );
}

function VerifyScreen() {
  const { status, proof, error, generate } = useProofGeneration();

  return (
    <View>
      <CameraQRScanner
        onScan={(data) =>
          generate({ qrData: data, nullifierSeed: 42n, revealAgeAbove18: true })
        }
        facing="back"
      />
      <ImageQRScanner onScan={(data) => generate({ qrData: data, nullifierSeed: 42n })} />
      <ProofStatus status={status} error={error} />
    </View>
  );
}
```

## API

### Provider

- `<AnonCitizenProvider config publicKey?>` — Same API as `@anoncitizen/react`

### Hooks (identical to @anoncitizen/react)

- `useAnonCitizen()` — SDK methods
- `useProofGeneration()` — Proof lifecycle management
- `useVerification()` — Verification lifecycle management

### Components

- `<CameraQRScanner onScan onError? facing?>` — Uses expo-camera for native QR scanning
- `<ImageQRScanner onScan onError? buttonLabel?>` — Gallery image picker for QR codes
- `<ProofStatus status error?>` — Mobile-optimized proof progress display

## Expo Requirements

Add to `app.json`:
```json
{
  "expo": {
    "plugins": ["expo-camera", "expo-image-picker"]
  }
}
```

## License

MIT
