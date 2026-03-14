# Test Strategy -- AnonCitizen

**Version:** 2.0
**Date:** 2026-03-13
**Author:** QA Engineering
**Status:** Phase 5 (QA & Security)

---

## 1. Test Strategy Overview

### 1.1 Philosophy

AnonCitizen is a privacy-preserving protocol where bugs have real consequences: a faulty circuit could leak personal information, a flawed nullifier could allow identity replay, and a miscoded contract could lock user proofs. The testing strategy is therefore built on three principles:

1. **Defense in depth.** Every layer (circuit, SDK, contract, UI) must be independently verified. A bug at one layer should be caught before it propagates.
2. **Correctness over coverage.** High line-coverage means nothing if the test uses mocked values that mask a real failure. Tests must exercise realistic data shapes, boundary conditions, and adversarial inputs.
3. **Reproducibility.** All test data must be deterministic. No test should depend on network access, real Aadhaar documents, or mutable external state.

### 1.2 Scope

| Layer | Package | Test Type | Framework |
|-------|---------|-----------|-----------|
| ZK Circuits | `packages/circuits/` | Unit + integration | circom_tester (wasm_tester) |
| Core SDK | `packages/core/` | Unit + integration | Vitest |
| React SDK | `packages/react/` | Unit + component | Vitest + @testing-library/react |
| React Native SDK | `packages/react-native/` | Unit + component | Vitest + @testing-library/react |
| Smart Contracts | `packages/contracts/` | Unit + integration + gas | Hardhat + Chai |
| E2E (Web) | `tests/e2e/` | End-to-end | Playwright |
| E2E (Mobile) | Not yet implemented | End-to-end | Detox or Maestro (planned) |

### 1.3 Approach

- **Unit tests** verify individual functions and sub-circuits in isolation, with external dependencies mocked (snarkjs, circomlibjs, expo-camera).
- **Integration tests** verify that multiple modules compose correctly (e.g., QR parser output feeds into prover input preparation).
- **Contract tests** deploy to a Hardhat local node and exercise the full Solidity call path.
- **E2E tests** drive a real browser against the web demo, testing the entire user journey from QR scan to proof verification.
- **Circuit tests** compile sub-circuits with circom_tester, compute witnesses, and assert both output correctness and constraint satisfaction.

---

## 2. Package-by-Package Coverage Plan

### 2.1 Circuit Tests (`packages/circuits/`)

**Framework:** circom_tester (wasm_tester), Chai assertions
**Test file:** `packages/circuits/test/aadhaar-verifier.test.ts`
**Test helper circuits:** `packages/circuits/test/circuits/test_*.circom`

#### Current Coverage

| Sub-Circuit | Tests | Status |
|-------------|-------|--------|
| TimestampConverter (ISTtoUTC) | IST offset subtraction, large timestamps | Covered |
| NullifierHasher | Determinism, different seeds produce different outputs, zero seed rejection | Covered |
| ConditionalReveal | Flag=1 reveals, flag=0 hides, non-boolean flag rejected | Covered |
| GenderEncoder | M=1, F=2, T=3, invalid byte rejected | Covered |
| AsciiDigitsToNumber | Parsing "2000", "560001" | Covered |
| SHA256Hasher | Not tested in isolation | Gap |
| RSAVerifier | Not tested in isolation | Gap |
| FieldExtractor | Not tested in isolation | Gap |
| Full AadhaarVerifier (integration) | Structural check only (file existence) | Gap |

#### Required Additional Tests

**SHA256Hasher (`lib/sha256_hasher.circom`):**
- Known-answer test: hash of empty input matches expected SHA-256
- Hash of a short message matches a reference value computed externally
- Constraint count documentation

**RSAVerifier (`lib/rsa_verifier.circom`):**
- Verify a known RSA-2048 signature using a test key pair (generate a dedicated test key, not a real UIDAI key)
- Reject a tampered signature (flip one bit in the message)
- Reject a signature from a different key
- Constraint count documentation

**FieldExtractor (`lib/field_extractor.circom`):**
- Extract field at known delimiter positions
- Handle delimiter at byte 0
- Handle consecutive delimiters (empty field)
- Extract last field before photo region

**Full AadhaarVerifier integration:**
- Generate a test RSA-2048 key pair
- Construct a synthetic Aadhaar QR payload (17 fields + photo + signature)
- Sign with the test key, produce valid circuit inputs, compute witness
- Verify all public outputs: nullifier, timestamp, pubKeyHash, signalHash
- Test each reveal flag independently
- Test with all reveals disabled (outputs should be zero)
- Document total constraint count

#### Signal Correctness Checks
- For every sub-circuit: `circuit.checkConstraints(witness)` on valid input
- For every sub-circuit: verify that invalid inputs cause `Assert Failed` or constraint violation
- For the full circuit: verify all 9 public outputs match expected values

#### Edge Cases
- Signed data at exactly MAX_DATA_BYTES (512)
- Photo at exactly MAX_PHOTO_BYTES (256)
- Minimum valid payload (shortest possible fields)
- Nullifier seed of 1 (smallest valid)
- Nullifier seed at SNARK_SCALAR_FIELD - 1 (largest valid)
- Timestamp near epoch boundaries

---

### 2.2 Core SDK Tests (`packages/core/`)

**Framework:** Vitest
**Test file:** `packages/core/test/core.test.ts`
**Mocked dependencies:** snarkjs, circomlibjs

#### Current Coverage

| Module | Describe Blocks | Approx. Test Count | Status |
|--------|-----------------|-------------------|--------|
| `utils.ts` | SNARK_SCALAR_FIELD, stringToBigInt, bigintToHex, hexToBytes, bytesToHex, round-trip, hashSignal, hashSignalPoseidon, generateNullifierSeed, packBytesToFieldElements | ~30 | Well covered |
| `qr-parser.ts` | String input, Uint8Array input, JPEG 2000 detection, emailMobileIndicator (0/1/2/3), error handling | ~15 | Well covered |
| `pre-verify.ts` | bytesToLimbs, parseRSAPublicKey, parseRSAPublicKeyFromCert, hashSignedData | ~18 | Well covered |
| `prover.ts` | prepareCircuitInputs (padding, limbs, flags, year extraction, timestamp, photoLength cap) | ~18 | Well covered |
| `verifier.ts` | decodePublicSignals, formatProofForContract, PUBLIC_SIGNAL_INDEX, NUM_PUBLIC_SIGNALS, Gender enum | ~25 | Well covered |
| `index.ts` (AnonCitizen class) | constructor, setPublicKey, preVerify guard, prove guard, verify guard, formatForContract, parseQR | ~10 | Covered |
| Cross-module integration | CircuitInputs shape, AadhaarQRPayload shape, all-zero signals, hash/seed usability | ~7 | Covered |

**Total existing:** ~120+ test cases.

#### Identified Gaps

1. **preVerifySignature() end-to-end** -- The actual RSA verification via Web Crypto API is not tested. The function is called by `AnonCitizen.prove()` but no test verifies a real signature check. Need a test with a known RSA key pair where:
   - Valid (signature, data, key) returns `true`
   - Tampered data returns `false`
   - Wrong key returns `false`
   - This requires either a Web Crypto polyfill in the test environment or an integration test that runs in a browser-like context.

2. **AnonCitizen.verify() with verificationKeyUrl** -- The `getVerificationKey()` private method has a branch that fetches a key from a URL. No test covers the fetch path. Need to mock `globalThis.fetch` and test:
   - Successful fetch and caching of the verification key
   - Failed fetch (404, network error) throws with descriptive message
   - Cached key is reused on subsequent calls

3. **AnonCitizen.prove() happy path** -- The full `prove()` flow (parseQR -> preVerify -> generateProof) is only tested for its guard clause. Need a test (with mocks) that verifies the full call chain.

4. **pako decompression fallback paths in qr-parser** -- The `tryDecompress` function tries inflate, inflateRaw, and ungzip in sequence. Tests cover error on all-fail but do not specifically test the inflateRaw and ungzip success paths.

5. **extractModulusFromDER edge cases** -- The ASN.1 parser in `pre-verify.ts` is tested with a constructed DER, but edge cases are sparse:
   - Certificate with 257-byte modulus (leading zero byte)
   - Certificate with modulus not at expected offset
   - Truncated certificate

6. **packBytesToFieldElements boundary** -- No test for input that is exactly a multiple of 31 bytes vs. not.

7. **Error message content** -- Several error paths are tested for throwing, but the error message text is not always asserted. For a developer-facing SDK, error messages are part of the API contract.

#### Recommended New Tests

```
describe("AnonCitizen.prove() full flow")
  it("should call parseQR, preVerify, and generateProof in sequence")
  it("should reject if preVerifySignature returns false")

describe("AnonCitizen.verify() with URL-based key")
  it("should fetch verification key from URL on first call")
  it("should cache verification key after first fetch")
  it("should throw on fetch failure with status text")
  it("should throw when neither key nor URL is configured")

describe("tryDecompress fallback paths")
  it("should succeed with inflateRaw when inflate fails")
  it("should succeed with ungzip when both inflate and inflateRaw fail")

describe("preVerifySignature with Web Crypto")
  it("should return true for valid RSA-2048 signature")
  it("should return false for tampered data")
  it("should return false when crypto.subtle is unavailable")
```

---

### 2.3 React SDK Tests (`packages/react/`)

**Framework:** Vitest + @testing-library/react + jsdom
**Test file:** `packages/react/test/react.test.tsx`
**Mocked dependencies:** @anoncitizen/core

#### Current Coverage

| Module | Component/Hook | Tests | Status |
|--------|---------------|-------|--------|
| `context.tsx` | AnonCitizenProvider | Renders children, creates SDK, passes public key, throws outside provider | Covered |
| `context.tsx` | Error handling | Attempted but placeholder (structural verification only) | Partial |
| `hooks.ts` | useAnonCitizen | isReady, prove delegation, verify delegation | Covered |
| `hooks.ts` | useProofGeneration | idle -> complete, idle -> error, non-Error throws, reset | Covered |
| `hooks.ts` | useVerification | idle -> verified, idle -> invalid, idle -> error, non-Error throws, reset | Covered |
| `components.tsx` | QRScanner | Camera mode (video element), file mode (input), camera denied fallback, file upload callback, className/style, width/height | Covered |
| `components.tsx` | ProofStatus | All 5 status texts, custom error, spinner presence/absence, accessibility (role, aria-live), className/style, border colors | Covered |

**Total existing:** ~35 test cases.

#### Identified Gaps

1. **Provider error handling** -- The test for initialization errors (line 128-208) is a placeholder. The `try/catch` inside the provider's `useEffect` is never actually exercised. Need a clean test using `vi.doMock` or a test-specific error-throwing constructor.

2. **useAnonCitizen "SDK not initialized" guard** -- The test acknowledges that testing `sdk === null` after the effect fires is difficult. The guard clause at hooks.ts line 64 (`if (!sdk) throw new Error("SDK not initialized")`) is not actually exercised. Need a test that captures the hook's `prove`/`verify` functions before the useEffect runs.

3. **QRScanner camera stream cleanup** -- When the component unmounts, camera streams should be stopped via `track.stop()`. No test verifies cleanup on unmount.

4. **QRScanner continuous scanning** -- No test verifies the `requestAnimationFrame` loop that reads video frames and decodes QR codes.

5. **Multiple provider instances** -- No test verifies that two providers with different configs create independent SDK instances.

6. **Re-rendering behavior** -- No test verifies what happens when the provider's `config` or `publicKey` props change after initial render.

7. **TypeScript type exports** -- No test verifies that the package re-exports the expected types from `@anoncitizen/core`.

#### Recommended New Tests

```
describe("Provider error handling")
  it("should set error state when AnonCitizen constructor throws")
  it("should set isReady=false on initialization error")

describe("QRScanner cleanup")
  it("should stop camera tracks on unmount")

describe("Config changes")
  it("should re-initialize SDK when config changes")
  it("should call setPublicKey when publicKey prop changes")
```

---

### 2.4 React Native SDK Tests (`packages/react-native/`)

**Framework:** Vitest + @testing-library/react
**Test file:** `packages/react-native/test/react-native.test.tsx`
**Mocked dependencies:** @anoncitizen/core, react-native

#### Current Coverage

| Module | Component/Hook | Tests | Status |
|--------|---------------|-------|--------|
| `context.tsx` | AnonCitizenProvider | Provides SDK context, throws outside provider | Covered |
| `hooks.ts` | useAnonCitizen | isReady, prove delegation, verify delegation | Covered |
| `hooks.ts` | useProofGeneration | idle, complete, error, reset | Covered |
| `hooks.ts` | useVerification | idle, verified, invalid, error, reset | Covered |
| API parity | Shape validation | useAnonCitizen, useProofGeneration, useVerification shapes match react package | Covered |

**Total existing:** ~18 test cases.

#### Identified Gaps

1. **CameraQRScanner component** -- Not tested at all. This is the most complex component in the package, with:
   - Permission request flow (null -> granted -> denied)
   - Dynamic import of `expo-camera`
   - Barcode scanning callback with `scanned` guard
   - "Tap to Scan Again" re-scan button
   - All three render states (loading, permission denied, camera active)

2. **ImageQRScanner component** -- Not tested at all. Needs tests for:
   - Dynamic import of `expo-image-picker`
   - Permission request
   - Image picker launch and result handling
   - Loading state while picking
   - Error handling for picker failure
   - base64 vs URI path branching

3. **ProofStatus component** -- Not tested. Should verify:
   - All 5 status states render correct text
   - ActivityIndicator shows only for "generating" status
   - Custom error message
   - Custom styles
   - Accessibility attributes (accessibilityRole, accessibilityLiveRegion)

4. **Error state in useAnonCitizen** -- The "throws when SDK not initialized" test (line 143-152) does not actually test the throw path; it just verifies `isReady === true`.

5. **publicKey prop on provider** -- No test verifies that `setPublicKey` is called when a publicKey is passed to the provider.

#### Recommended New Tests

```
describe("CameraQRScanner")
  it("should show loading indicator while requesting permission")
  it("should show error message when permission denied")
  it("should render camera view when permission granted")
  it("should call onScan when barcode detected")
  it("should prevent duplicate scans")
  it("should allow re-scanning after tap")
  it("should call onError when expo-camera import fails")

describe("ImageQRScanner")
  it("should show pick button by default")
  it("should show loading indicator while picking")
  it("should call onScan with base64 data")
  it("should call onScan with URI when no base64")
  it("should show alert when permission denied")
  it("should apply custom button styles")

describe("ProofStatus (React Native)")
  it("should render correct text for each status")
  it("should show ActivityIndicator for generating status")
  it("should show custom error message")
  it("should apply accessibility attributes")
```

---

### 2.5 Contract Tests (`packages/contracts/`)

**Framework:** Hardhat + Chai + ethers.js
**Test file:** `packages/contracts/test/AnonCitizen.test.ts`
**Contracts under test:** `AnonCitizen.sol`, `IAnonCitizen.sol`, `Groth16Verifier.sol`

#### Current Coverage

| Category | Tests | Status |
|----------|-------|--------|
| Deployment | Verifier address, no initial nullifiers, owner set | Covered |
| PubKeyHash registry | Add, remove, non-owner rejection, untrusted rejection | Covered |
| Nullifier tracking | Zero nullifier, field overflow, untrusted after nullifier passes | Covered |
| verifyOnly | Returns false for placeholder verifier | Covered |
| Interface compliance | Function existence checks | Covered |

**Total existing:** ~12 test cases.

#### Identified Gaps

1. **NullifierAlreadyUsed revert** -- No test exercises the replay prevention path. After a successful `verifyAndRecord`, a second call with the same nullifier should revert with `NullifierAlreadyUsed`. This path cannot be reached with the placeholder verifier (all proofs fail), so it requires either:
   - A mock verifier contract that always returns `true`
   - Real circuit artifacts from a trusted setup

2. **ProofVerified event emission** -- No test verifies that the `ProofVerified` event is emitted with the correct indexed/non-indexed parameters after a successful verification.

3. **Gas benchmarks** -- The test file documents expected gas costs in a comment but does not actually measure them. Need `REPORT_GAS=true` runs with assertions on:
   - Deploy Groth16Verifier: expected ~1,500,000
   - Deploy AnonCitizen: expected ~400,000
   - `verifyAndRecord`: expected ~260,000
   - `verifyOnly`: expected ~230,000
   - `isNullifierUsed`: expected ~2,600

4. **verifyAndRecord with valid proof** -- No test exercises the happy path (valid proof -> nullifier recorded -> event emitted). Requires a mock verifier or real artifacts.

5. **signalHash validation** -- The contract has an `InvalidSignalHash` error defined but no code path that reverts with it. Either the error is dead code (flag for removal) or there is a missing validation check.

6. **Ownership transfer** -- The contract uses `immutable owner` (no transfer mechanism). This is intentional but should be documented with a test that confirms no `transferOwnership` function exists.

7. **Multiple trusted pubKeyHashes** -- No test adds multiple keys and verifies independent operation.

8. **Edge case: pubKeyHash = 0** -- No test checks whether adding/removing a zero pubKeyHash is handled correctly.

#### Recommended New Tests (with Mock Verifier)

```solidity
// MockVerifier.sol -- for testing
contract MockVerifier {
    bool public shouldVerify = true;
    function verifyProof(...) external view returns (bool) {
        return shouldVerify;
    }
}
```

```
describe("verifyAndRecord (with mock verifier)")
  it("should record nullifier on valid proof")
  it("should emit ProofVerified event with correct parameters")
  it("should revert NullifierAlreadyUsed on replay")
  it("should revert InvalidProof when verifier returns false")

describe("Gas benchmarks")
  it("should deploy Groth16Verifier within gas budget")
  it("should deploy AnonCitizen within gas budget")
  it("should verify and record within gas budget")

describe("Edge cases")
  it("should handle multiple trusted pubKeyHashes independently")
  it("should handle pubKeyHash=0 gracefully")
  it("should not expose transferOwnership function")
```

---

## 3. E2E Tests (Playwright)

**Framework:** Playwright
**Config:** `tests/e2e/playwright.config.ts`
**Test file:** `tests/e2e/web-demo.spec.ts`
**Target:** Web demo at `http://localhost:5173` (Vite dev server)

### Current Coverage

| Test | Status | Notes |
|------|--------|-------|
| App title and initial scan step | Covered | Basic page load |
| SDK initialization status | Covered | Heading visibility |
| QR scanner render | Covered | Weak selector (first element with class) |
| File upload fallback | Covered | Conditional on camera denial |
| Navigate to field selection after QR scan | Covered | Conditional, uses fake QR data |
| Field selection checkboxes | Placeholder | Only checks heading |
| Invalid QR data handling | Covered | Verifies no crash |
| Cross-browser compatibility | Covered | Chromium, Firefox, WebKit |

**Total existing:** 8 test cases (several are shallow).

### Identified Gaps

1. **Full proof generation flow** -- No test goes from QR scan through proof generation to seeing a "proof generated" confirmation. Blocked by circuit artifacts, but can be partially tested with a service worker mock that returns pre-computed proof data.

2. **Field selection interaction** -- The "field selection checkboxes" test is a placeholder. Need tests that:
   - Toggle each reveal checkbox (age, gender, state, pincode)
   - Verify the UI reflects the selected fields
   - Verify the proof request includes the correct flags

3. **Verification display** -- No test verifies the verification result display (valid/invalid, revealed fields).

4. **Error state UI** -- No test verifies what the UI shows when proof generation fails (error message, retry button).

5. **QR scanner selectors are fragile** -- `page.locator("[class]").first()` will match anything. Needs data-testid attributes on scanner elements.

6. **Mobile viewport** -- No test runs in a mobile viewport (important for a mobile-first use case).

7. **Accessibility** -- No Playwright test checks keyboard navigation, screen reader text, or ARIA attributes.

### Recommended New Tests

```
describe("QR Upload Flow (with mocked artifacts)")
  it("should upload QR image and show parsed fields")
  it("should show error for corrupt QR image")

describe("Field Selection")
  it("should toggle age checkbox and update proof request")
  it("should toggle gender checkbox and update proof request")
  it("should toggle state checkbox and update proof request")
  it("should toggle pincode checkbox and update proof request")

describe("Proof Generation (with mocked snarkjs)")
  it("should show 'generating' spinner during proof generation")
  it("should show 'proof generated' on completion")
  it("should show error message on failure")

describe("Mobile Viewport")
  it("should render correctly on iPhone 14 viewport")
  it("should render correctly on Pixel 7 viewport")

describe("Accessibility")
  it("should have no axe violations on the scan page")
  it("should be navigable via keyboard")
```

### Playwright Configuration Notes

The current config is well-structured with:
- Three browser projects (Chromium, Firefox, WebKit)
- Screenshot on failure, trace on first retry
- Auto-start web server via `pnpm --filter @anoncitizen/web-demo dev`
- 30-second timeout with 1 retry

Recommended additions:
- Add a mobile viewport project (e.g., `devices["iPhone 14"]`)
- Add `video: "on-first-retry"` for debugging flaky tests
- Consider adding `expect.toHaveScreenshot()` for visual regression

---

## 4. Coverage Thresholds

| Package | Line Coverage | Branch Coverage | Function Coverage | Enforcement |
|---------|--------------|-----------------|-------------------|-------------|
| `@anoncitizen/core` | 80% | 75% | 85% | CI gate (vitest --coverage) |
| `@anoncitizen/react` | 70% | 65% | 75% | CI gate (vitest --coverage) |
| `@anoncitizen/react-native` | 70% | 65% | 75% | CI gate (vitest --coverage) |
| `@anoncitizen/contracts` | 90% | 85% | 95% | CI gate (solidity-coverage) |
| `@anoncitizen/circuits` | N/A | N/A | N/A | Manual review (constraint count doc) |

### Coverage Enforcement

Coverage thresholds should be enforced in CI via vitest configuration:

```typescript
// vitest.config.ts (per package)
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 85,
        statements: 80,
      },
    },
  },
});
```

For contracts, use `hardhat-gas-reporter` and `solidity-coverage`:

```typescript
// hardhat.config.ts
import "solidity-coverage";
import "hardhat-gas-reporter";

const config: HardhatUserConfig = {
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};
```

---

## 5. Test Gap Summary

### Critical Gaps (must fix before release)

| # | Package | Gap | Risk | Priority |
|---|---------|-----|------|----------|
| G1 | circuits | No full AadhaarVerifier integration test | Circuit could have cross-sub-circuit bugs | P0 |
| G2 | circuits | SHA256Hasher and RSAVerifier not tested in isolation | Hash/signature bugs would break all proofs | P0 |
| G3 | contracts | No test for NullifierAlreadyUsed (replay prevention) | Core security property untested | P0 |
| G4 | contracts | No test for ProofVerified event emission | Integrators depend on events for indexing | P1 |
| G5 | contracts | No gas benchmarks measured | Could exceed block gas limit on L2s | P1 |
| G6 | core | preVerifySignature not tested with real Web Crypto | RSA pre-check could silently pass bad signatures | P1 |
| G7 | core | AnonCitizen.verify() URL fetch path untested | Verification key fetching could fail silently | P2 |

### Moderate Gaps (should fix)

| # | Package | Gap | Risk | Priority |
|---|---------|-----|------|----------|
| G8 | react | Provider error handling is a placeholder | Initialization errors could crash the app | P2 |
| G9 | react | QRScanner camera cleanup on unmount | Memory leak, camera stays on | P2 |
| G10 | react-native | CameraQRScanner completely untested | Core user-facing component | P2 |
| G11 | react-native | ImageQRScanner completely untested | Alternative scan path untested | P2 |
| G12 | react-native | ProofStatus component untested | UI feedback untested | P3 |
| G13 | e2e | No test covers full proof-to-verification flow | Happy path untested end-to-end | P2 |
| G14 | e2e | Field selection test is a placeholder | Core UX flow untested | P2 |
| G15 | contracts | Dead `InvalidSignalHash` error -- no revert path uses it | Dead code or missing validation | P3 |

### Low-Priority Gaps (nice to have)

| # | Package | Gap | Priority |
|---|---------|-----|----------|
| G16 | core | pako fallback paths (inflateRaw, ungzip success) | P3 |
| G17 | core | extractModulusFromDER edge cases (257-byte, truncated) | P3 |
| G18 | react | Multiple provider instances | P4 |
| G19 | react | Config/publicKey prop changes after mount | P3 |
| G20 | e2e | Mobile viewport testing | P3 |
| G21 | e2e | Accessibility audit (axe-core) | P3 |

---

## 6. Testing Tools and Infrastructure

### 6.1 Tools by Package

| Tool | Purpose | Used In |
|------|---------|---------|
| **Vitest** | Unit/integration test runner | core, react, react-native |
| **@testing-library/react** | React component/hook testing | react, react-native |
| **jsdom** | Browser DOM simulation for Vitest | react |
| **circom_tester** | Circom circuit compilation and witness testing | circuits |
| **Hardhat** | Solidity compilation, local EVM, test runner | contracts |
| **Chai** | Assertion library | circuits, contracts |
| **ethers.js** | Ethereum interaction in tests | contracts |
| **Playwright** | Cross-browser E2E testing | e2e |
| **snarkjs** | ZK proof generation/verification (mocked in unit tests) | core (mocked) |
| **pako** | Zlib decompression (real in tests) | core (via qr-parser) |
| **@noble/hashes** | SHA-256 hashing (real in tests) | core (via pre-verify) |

### 6.2 Mocking Strategy

| Dependency | Why Mocked | Mock Approach |
|------------|-----------|---------------|
| snarkjs | No circuit artifacts available in unit tests | `vi.mock("snarkjs")` returning deterministic proof/verification |
| circomlibjs | Poseidon build is slow and requires WASM | `vi.mock("circomlibjs")` returning a fake Poseidon function |
| @anoncitizen/core | React SDKs test hooks, not SDK internals | `vi.mock("@anoncitizen/core")` with class mock |
| react-native | RN primitives not available in jsdom | `vi.mock("react-native")` with string component stubs |
| expo-camera | Not available outside Expo runtime | Dynamic import mock in component tests |
| expo-image-picker | Not available outside Expo runtime | Dynamic import mock in component tests |
| Web Crypto API | Not available in all test environments | Can be polyfilled with `@peculiar/webcrypto` for integration tests |

### 6.3 Test Data

| Data Type | Source | Location |
|-----------|--------|----------|
| Synthetic QR payload | Hand-constructed in `createSampleSignedData()` | `packages/circuits/test/aadhaar-verifier.test.ts` |
| Compressed QR bytes | Generated via `pako.deflate()` in test helpers | `packages/core/test/core.test.ts` |
| DER certificate | Hand-constructed ASN.1 with known modulus | `packages/core/test/core.test.ts` |
| RSA key limbs | Computed from sequential BigInts | `packages/circuits/test/aadhaar-verifier.test.ts` |
| Sample public signals | Hardcoded array matching circuit output order | `packages/contracts/test/AnonCitizen.test.ts` |

**Note:** No real Aadhaar QR data is used anywhere in the test suite. All test data is synthetic and deterministic.

### 6.4 CI Integration

Tests should run in the following CI pipeline stages:

```
Stage 1 (parallel):
  - pnpm --filter @anoncitizen/core test --coverage
  - pnpm --filter @anoncitizen/react test --coverage
  - pnpm --filter @anoncitizen/react-native test --coverage

Stage 2 (parallel, requires Stage 1):
  - pnpm --filter @anoncitizen/contracts test
  - pnpm --filter @anoncitizen/circuits test

Stage 3 (requires Stage 2):
  - npx playwright test tests/e2e/

Stage 4 (manual gate):
  - Constraint count comparison against baseline
  - Gas benchmark comparison against baseline
  - Coverage report upload to dashboard
```

### 6.5 Test Commands

```bash
# Run all tests across the monorepo
pnpm turbo test

# Individual packages
pnpm --filter @anoncitizen/core test
pnpm --filter @anoncitizen/react test
pnpm --filter @anoncitizen/react-native test
pnpm --filter @anoncitizen/contracts test
pnpm --filter @anoncitizen/circuits test

# With coverage
pnpm --filter @anoncitizen/core test -- --coverage

# Contract gas benchmarks
cd packages/contracts && REPORT_GAS=true npx hardhat test

# E2E tests
npx playwright test tests/e2e/web-demo.spec.ts

# E2E with specific browser
npx playwright test --project=chromium

# E2E with UI mode (debugging)
npx playwright test --ui
```

---

## 7. Known Limitations and Blockers

1. **No trusted setup yet.** Full circuit integration tests and contract proof verification tests are blocked until the Groth16 trusted setup ceremony produces WASM, zkey, and verification key artifacts.

2. **No real Aadhaar QR data.** For privacy reasons, no real Aadhaar data can be committed to the repository. All tests use synthetic data. This means certain edge cases in QR parsing (real-world encoding variations, non-Latin characters in names) are not covered.

3. **Web Crypto availability.** The `preVerifySignature` function uses `crypto.subtle`, which is not available in all Node.js test environments without polyfilling. Integration tests for RSA verification require `@peculiar/webcrypto` or Node.js 20+ with `--experimental-global-webcrypto`.

4. **expo-camera and expo-image-picker.** These are only available inside the Expo runtime. React Native component tests must mock these dynamic imports entirely. True device testing requires a separate Detox/Maestro test suite.

5. **Circuit compilation time.** Circom compilation is slow (sub-circuits: ~30s, full circuit: ~5min). CI should cache compiled artifacts and only recompile when `.circom` files change.

---

## 8. Quality Gates (Release Criteria)

Before any release, the following gates must pass:

- [ ] All unit tests pass across all 5 packages
- [ ] Coverage thresholds met (80% core, 70% react/react-native, 90% contracts)
- [ ] All E2E tests pass on Chromium, Firefox, and WebKit
- [ ] Constraint count documented and within budget
- [ ] Gas benchmarks documented and within budget
- [ ] No P0 or P1 test gaps remain open
- [ ] Security audit findings resolved or accepted with documented rationale
- [ ] No `TODO` or `FIXME` comments in test files related to skipped security tests
