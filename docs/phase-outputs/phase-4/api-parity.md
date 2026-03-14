# API Parity: @anoncitizen/react vs @anoncitizen/react-native

## Provider & Context

| Export | react | react-native | Identical Signature |
|---|---|---|---|
| `AnonCitizenProvider` | ✅ | ✅ | ✅ |
| `useAnonCitizenContext()` | ✅ | ✅ | ✅ |
| `AnonCitizenProviderProps` | ✅ | ✅ | ✅ |
| `AnonCitizenContextValue` | ✅ | ✅ | ✅ |

## Hooks

| Hook | react | react-native | Identical Signature |
|---|---|---|---|
| `useAnonCitizen()` | ✅ | ✅ | ✅ |
| `useProofGeneration()` | ✅ | ✅ | ✅ |
| `useVerification()` | ✅ | ✅ | ✅ |

### Return Type Parity

| Type | react | react-native | Identical |
|---|---|---|---|
| `UseAnonCitizenReturn` | ✅ | ✅ | ✅ |
| `UseProofGenerationReturn` | ✅ | ✅ | ✅ |
| `UseVerificationReturn` | ✅ | ✅ | ✅ |
| `ProofStatus` (union type) | ✅ | ✅ | ✅ |
| `VerifyStatus` (union type) | ✅ | ✅ | ✅ |

## Components

| Component | react | react-native | Notes |
|---|---|---|---|
| `QRScanner` | ✅ | — | Web: BarcodeDetector API + file upload fallback |
| `CameraQRScanner` | — | ✅ | Mobile: expo-camera with barcode scanning |
| `ImageQRScanner` | — | ✅ | Mobile: expo-image-picker for gallery QR images |
| `ProofStatus` | ✅ | ✅ | Web uses HTML div; Mobile uses RN View + ActivityIndicator |

### Component Differences (by design)

Components differ between platforms because they wrap platform-specific APIs:

- **Web `QRScanner`**: Uses `navigator.mediaDevices.getUserMedia` + `BarcodeDetector` API with `<input type="file">` fallback. Props use `CSSProperties` for styling.
- **Mobile `CameraQRScanner`**: Uses `expo-camera` `CameraView` with native barcode detection. Props use React Native `ViewStyle`.
- **Mobile `ImageQRScanner`**: Uses `expo-image-picker` for gallery access. No web equivalent (web `QRScanner` has built-in file upload).
- **`ProofStatus`**: Same status values and behavior. Web renders `<div>` with inline CSS; Mobile renders `<View>` + `<Text>` with `StyleSheet`.

## Re-exported Core Types

Both packages re-export identical types from `@anoncitizen/core`:

| Type | react | react-native |
|---|---|---|
| `AnonCitizenConfig` | ✅ | ✅ |
| `ProofRequest` | ✅ | ✅ |
| `AnonCitizenProof` | ✅ | ✅ |
| `VerificationResult` | ✅ | ✅ |
| `ContractCalldata` | ✅ | ✅ |
| `Gender` | ✅ | ✅ |

## Summary

- **Hooks**: 100% API parity — identical function signatures and return types
- **Provider**: 100% API parity — identical props and context shape
- **Components**: Platform-appropriate divergence — different component names/props for QR scanning, identical status values for ProofStatus
- **Types**: All shared types sourced from `@anoncitizen/core`, zero duplication
