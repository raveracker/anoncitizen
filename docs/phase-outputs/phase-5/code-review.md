# AnonCitizen Monorepo -- Code Review

**Date:** 2026-03-13
**Reviewer:** Claude Opus 4.6 (automated)
**Scope:** All source files across `packages/core`, `packages/react`, `packages/react-native`, `packages/contracts`, `examples/web-demo`, and `examples/mobile-demo`

---

## Summary

The AnonCitizen monorepo is well-structured with clean separation between core logic, framework-specific SDKs, smart contracts, and example applications. The codebase demonstrates strong TypeScript practices with good JSDoc coverage, consistent error handling patterns, and a thoughtful public API surface. However, there are several issues ranging from near-identical code duplication between the react and react-native packages, a couple of type-safety gaps, a security-relevant silent failure mode in pre-verification, and performance concerns around repeated Poseidon instantiation. The Solidity contracts are solid but ship with placeholder verification keys that must be replaced before deployment.

---

## Findings Table

| ID | Severity | Category | File(s) | Finding |
|----|----------|----------|---------|---------|
| CR-01 | High | Code Duplication | `react/src/context.tsx`, `react-native/src/context.tsx` | context.tsx is 100% identical between react and react-native packages |
| CR-02 | High | Code Duplication | `react/src/hooks.ts`, `react-native/src/hooks.ts` | hooks.ts is 100% identical between react and react-native packages |
| CR-03 | High | Error Handling / Security | `core/src/pre-verify.ts:40-42` | `preVerifySignature` swallows all exceptions and returns `false` |
| CR-04 | High | Performance | `core/src/utils.ts:42-51` | `buildPoseidon()` called on every `hashSignalPoseidon` invocation -- no caching |
| CR-05 | High | Configuration | `contracts/contracts/Groth16Verifier.sol` | All IC and delta/gamma verification key constants are identical placeholder values |
| CR-06 | Medium | Type Safety | `core/src/verifier.ts:9` | `Gender` is imported as a type but used as a value cast target |
| CR-07 | Medium | Type Safety | `core/src/index.ts:207-208` | `getVerificationKey()` uses non-null assertion `this.verificationKey!` |
| CR-08 | Medium | Bundle Size | `core/src/prover.ts:45` | `snarkjs` dynamically imported on every `generateProof` call -- no caching |
| CR-09 | Medium | API Design | `react-native/src/components.tsx:58-72` | `useState` misused as initializer -- should be `useEffect` for async camera init |
| CR-10 | Medium | Dead Code | `react/src/hooks.ts:143-147` | `useProofGeneration` sets status to "parsing" then immediately overwrites to "generating" |
| CR-11 | Medium | Dead Code | `react-native/src/hooks.ts:144-149` | Same "parsing" status dead code as react package |
| CR-12 | Medium | Dependency Hygiene | `react-native/package.json` | `expo-image-picker` used in components but not listed in peerDependencies |
| CR-13 | Medium | Naming | `core/src/index.ts` | Barrel re-exports `Gender` as both a value and a type (via `export type { ... Gender }`) |
| CR-14 | Medium | Error Handling | `react/src/components.tsx:158-166` | File upload handler passes raw data URL instead of decoded QR content |
| CR-15 | Medium | Contract Security | `contracts/contracts/AnonCitizen.sol` | No `signalHash` validation (non-zero check) before proof verification |
| CR-16 | Medium | Type Safety | `core/src/types.ts:218-219` | `CircuitInputs` uses index signature `[key: string]: string | string[]` which loosens all named properties |
| CR-17 | Low | JSDoc | `core/src/prover.ts:117-123` | `padArray` helper is undocumented |
| CR-18 | Low | JSDoc | `core/src/pre-verify.ts:159-180` | Private utility functions (`bigintToBytes`, `bytesToBase64url`, `base64ToBytes`) lack JSDoc |
| CR-19 | Low | Naming | `react/src/index.ts:32-33` | `ProofStatus` type alias re-exported as `ProofStatusType` to avoid collision with component |
| CR-20 | Low | Configuration | `contracts/tsconfig.json` | Contracts tsconfig uses `module: "commonjs"` while rest of monorepo uses ESM |
| CR-21 | Low | Configuration | `react/tsconfig.json`, `react-native/tsconfig.json` | Both include `../core/src/circomlibjs.d.ts` as a cross-package file dependency |
| CR-22 | Low | Bundle Size | `core/package.json` | `pako` is a full dependency (~45KB) used only for QR decompression |
| CR-23 | Low | API Design | `core/src/qr-parser.ts:51` | `MAX_QR_STRING_LENGTH` is a module-private constant, not configurable |
| CR-24 | Info | Architecture | `react/src/index.ts`, `react-native/src/index.ts` | Both packages re-export core types -- consumers may import from either, creating ambiguity |
| CR-25 | Info | Testing | Various | No test files for react or react-native packages; only core and contracts have tests |
| CR-26 | Info | Solidity | `contracts/contracts/Groth16Verifier.sol:13` | Groth16Verifier uses a wider pragma (`>=0.7.0 <0.9.0`) than AnonCitizen (`^0.8.20`) |
| CR-27 | Info | DX | `core/src/pre-verify.ts:170` | `bytesToBase64url` uses spread operator on Uint8Array which may fail for large arrays (>~65K elements) |
| CR-28 | Info | Configuration | `react-native/package.json` | `react` is in devDependencies but not in peerDependencies |

---

## Detailed Findings

### CR-01 / CR-02: Complete Code Duplication Between react and react-native Packages (High)

**Files:**
- `packages/react/src/context.tsx` vs `packages/react-native/src/context.tsx`
- `packages/react/src/hooks.ts` vs `packages/react-native/src/hooks.ts`

The `context.tsx` files are byte-for-byte identical across both packages. The `hooks.ts` files are also 100% identical. This means any bug fix or feature addition must be applied twice.

**Recommendation:** Extract the shared context and hooks into a platform-agnostic internal package (e.g., `@anoncitizen/sdk-shared` or an unexported `packages/shared/`) that both react and react-native import from. Only the `components.tsx` files and `index.ts` barrel exports differ between the two packages and should remain separate.

---

### CR-03: Silent Exception Swallowing in preVerifySignature (High)

**File:** `packages/core/src/pre-verify.ts`, lines 40-42

```typescript
} catch {
  return false;
}
```

The `preVerifySignature` function catches all exceptions and returns `false`. This hides errors that are not signature failures -- for example, a misconfigured `crypto.subtle` environment (Node.js without `--experimental-global-webcrypto` on older versions), malformed key data, or out-of-memory conditions. When `prove()` calls `preVerifySignature` and it returns `false`, the user gets "RSA signature verification failed" even when the actual problem is environmental.

**Recommendation:** Re-throw non-cryptographic errors. At minimum, catch a specific error type or log the underlying error for debugging:

```typescript
} catch (err) {
  // Only swallow crypto verification errors
  if (err instanceof DOMException || (err instanceof Error && err.name === 'OperationError')) {
    return false;
  }
  throw err;
}
```

---

### CR-04: buildPoseidon() Called on Every hashSignal Invocation (High)

**File:** `packages/core/src/utils.ts`, lines 42-51

```typescript
export async function hashSignalPoseidon(signal: string): Promise<bigint> {
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  // ...
}
```

`buildPoseidon()` is an expensive operation that builds WASM-based finite field arithmetic. It is called every time `hashSignal` is invoked, which happens during every proof generation. The Poseidon instance should be cached at module level.

**Recommendation:**
```typescript
let poseidonPromise: Promise<PoseidonFunction> | null = null;

async function getPoseidon(): Promise<PoseidonFunction> {
  if (!poseidonPromise) {
    poseidonPromise = import("circomlibjs").then(m => m.buildPoseidon());
  }
  return poseidonPromise;
}
```

---

### CR-05: Groth16Verifier Contains Only Placeholder Verification Key Values (High)

**File:** `packages/contracts/contracts/Groth16Verifier.sol`

All 10 IC points (IC0 through IC9), plus the delta point, share the same x/y coordinates. These are clearly placeholder values (the comment on line 55 confirms: "PLACEHOLDER values -- replace after trusted setup"). Deploying this contract as-is would accept invalid proofs.

**Recommendation:** Add a CI check that fails if the Groth16Verifier contains duplicate IC values (a simple static analysis). Document the replacement procedure in the deployment guide. Consider gating the `build` script to reject compilation if placeholders are detected.

---

### CR-06: Gender Import Used as Type but Cast as Value (Medium)

**File:** `packages/core/src/verifier.ts`, line 9

```typescript
import type {
  // ...
  Gender,
  // ...
} from "./types.js";
```

`Gender` is imported with `import type`, but on line 72 it is used as a runtime cast target: `genderRaw as Gender`. While TypeScript erases this at compile time (it is just an `as` assertion), the `import type` declaration technically signals this is not a runtime dependency. This works because `Gender` is an enum and the cast is purely a type assertion, but it is misleading.

**Recommendation:** Import `Gender` as a value import in `verifier.ts` since it is an enum that could be used for runtime comparisons. The current code works but violates the semantic contract of `import type`.

---

### CR-07: Non-null Assertion on Possibly-null verificationKey (Medium)

**File:** `packages/core/src/index.ts`, line 208

```typescript
this.verificationKey = await response.json();
return this.verificationKey!;
```

After assigning `response.json()` (which returns `any`), the non-null assertion `!` is used. If the response body is `null` or `undefined`, this assertion would hide the bug. The `response.json()` return is also unvalidated -- there is no schema check that the JSON matches the `VerificationKey` interface.

**Recommendation:** Add runtime validation of the verification key shape, or at minimum a null check:

```typescript
const vkey = await response.json() as VerificationKey;
if (!vkey || typeof vkey.nPublic !== 'number') {
  throw new Error("Invalid verification key format");
}
this.verificationKey = vkey;
return vkey;
```

---

### CR-08: Dynamic snarkjs Import Without Caching (Medium)

**File:** `packages/core/src/prover.ts`, line 45

```typescript
const snarkjs = await import("snarkjs");
```

`snarkjs` is dynamically imported every time `generateProof` is called. While modern bundlers may cache dynamic imports, this is not guaranteed in all environments (e.g., Node.js ESM). The same pattern appears in `verifier.ts` line 26.

**Recommendation:** Cache the import promise at module level, similar to the Poseidon fix recommended in CR-04.

---

### CR-09: useState Misused as One-time Initializer in CameraQRScanner (Medium)

**File:** `packages/react-native/src/components.tsx`, lines 58-72

```typescript
useState(() => {
  (async () => {
    try {
      const mod = await import("expo-camera");
      // ...
    }
  })();
});
```

`useState` with a function argument is used to run an async side effect. While this technically executes once (the initializer function runs only on first render), it is a misuse of the `useState` API. The initializer is meant for computing initial state synchronously, not for triggering async side effects. React's future concurrent features may call initializers without committing, leading to double-execution.

**Recommendation:** Replace with `useEffect` (with an empty dependency array) for the async camera initialization logic.

---

### CR-10 / CR-11: Dead "parsing" Status in useProofGeneration (Medium)

**Files:** `packages/react/src/hooks.ts` lines 143-147, `packages/react-native/src/hooks.ts` lines 144-149

```typescript
setStatus("parsing");
setError(null);
setProof(null);

setStatus("generating");
const result = await sdk.prove(request);
```

The status is set to `"parsing"` and then immediately overwritten to `"generating"` before any async operation yields. React batches state updates, so the `"parsing"` status will never be rendered. The `ProofStatus` type includes `"parsing"` as a valid value, and the `ProofStatus` component renders a message for it, but users will never see it.

**Recommendation:** Either remove the "parsing" status entirely, or insert an actual parsing step (e.g., `await sdk.parseQR(request.qrData)`) between setting "parsing" and "generating" statuses.

---

### CR-12: expo-image-picker Missing from peerDependencies (Medium)

**File:** `packages/react-native/package.json`

The `ImageQRScanner` component dynamically imports `expo-image-picker`, but this dependency is only listed in `devDependencies`. Consumers who install `@anoncitizen/react-native` will not be prompted to install `expo-image-picker`, and the component will fail at runtime with a cryptic import error.

**Recommendation:** Add `"expo-image-picker": ">=17.0.0"` to `peerDependencies`. Mark it as optional if not all consumers need the image picker:

```json
"peerDependenciesMeta": {
  "expo-image-picker": { "optional": true }
}
```

---

### CR-13: Gender Re-exported as Both Type and Value (Medium)

**File:** `packages/react/src/index.ts`, `packages/react-native/src/index.ts`

`Gender` is exported from `@anoncitizen/core` as a value (it is an enum). However, both `@anoncitizen/react` and `@anoncitizen/react-native` re-export it as `export type { Gender }` (type-only export on line 48). This means consumers who import `Gender` from `@anoncitizen/react` cannot use it as a runtime value (e.g., `Gender.Male` for comparisons). The enum is erased at compile time.

**Recommendation:** Change the react and react-native barrel files to re-export `Gender` as a value: `export { Gender } from "@anoncitizen/core"`.

---

### CR-14: QR File Upload Passes Data URL Instead of QR Content (Medium)

**File:** `packages/react/src/components.tsx`, lines 158-166

```typescript
reader.onload = async () => {
  const data = reader.result as string;
  onScan(data);
};
reader.readAsDataURL(file);
```

When a user uploads a QR code image, the raw data URL (e.g., `data:image/png;base64,...`) is passed to `onScan`. This is not the decoded QR string -- it is the base64-encoded image data. The downstream `parseQRCode()` function expects either a decimal digit string or raw bytes, and will fail with "Invalid QR data: expected a decimal digit string".

**Recommendation:** Document that the file upload path requires a client-side QR decoding library (e.g., jsQR), or integrate one. The comment on line 162 acknowledges this gap but the API contract is misleading since `onScan` implies the data is usable.

---

### CR-15: No signalHash Validation in AnonCitizen Contract (Medium)

**File:** `packages/contracts/contracts/AnonCitizen.sol`

The contract validates nullifier (non-zero, in-field) and pubKeyHash (trusted), but does not validate `signalHash` (`_pubSignals[3]`). An attacker could submit a proof with `signalHash = 0`, which would pass verification if the proof was generated without signal binding. Applications that rely on signal binding for front-running protection should validate the signal hash matches their expected value.

**Recommendation:** Either add a `signalHash` parameter to `verifyAndRecord` that is checked against `_pubSignals[3]`, or document that callers must perform this check externally.

---

### CR-16: Loose Index Signature on CircuitInputs (Medium)

**File:** `packages/core/src/types.ts`, lines 217-234

```typescript
export interface CircuitInputs {
  [key: string]: string | string[];
  signedData: string[];
  // ...
}
```

The index signature `[key: string]: string | string[]` allows any arbitrary key to be set, defeating the purpose of the named properties. It was likely added to satisfy snarkjs's input type requirements, but it means typos in property names (e.g., `signeddata` instead of `signedData`) will not produce type errors.

**Recommendation:** Use a type intersection instead:

```typescript
export type CircuitInputs = {
  signedData: string[];
  signedDataLength: string;
  // ... all named fields
} & Record<string, string | string[]>;
```

Or better, create a strict type and cast to `Record<string, string | string[]>` only at the snarkjs call site.

---

### CR-17 / CR-18: Missing JSDoc on Helper Functions (Low)

Several internal helper functions lack JSDoc documentation:
- `padArray` in `prover.ts`
- `bigintToBytes`, `bytesToBase64url`, `base64ToBytes` in `pre-verify.ts`
- `extractDocumentYear`, `findTimestampStart` in `prover.ts`

While these are not public API, they contain non-obvious logic (e.g., `extractDocumentYear`'s fallback to current year) that benefits from documentation.

---

### CR-19: ProofStatus Name Collision Workaround (Low)

**File:** `packages/react/src/index.ts`, line 32

```typescript
export type { ProofStatus as ProofStatusType } from "./hooks.js";
```

The `ProofStatus` type (union of status strings) collides with the `ProofStatus` component. The alias `ProofStatusType` works but is inelegant.

**Recommendation:** Rename the type to `ProofGenerationStatus` in `hooks.ts` to avoid the collision without needing an alias.

---

### CR-20: Contracts tsconfig Uses CommonJS Module System (Low)

**File:** `packages/contracts/tsconfig.json`

The contracts package uses `"module": "commonjs"` while the rest of the monorepo uses `"module": "ESNext"`. This is likely intentional for Hardhat compatibility, but it means Hardhat scripts and tests cannot use top-level `await` or ESM-only packages.

**Recommendation:** Document this as intentional. Consider whether Hardhat's ESM support (available since v2.19) could be leveraged.

---

### CR-21: Cross-Package File Inclusion in tsconfigs (Low)

**Files:** `packages/react/tsconfig.json`, `packages/react-native/tsconfig.json`

Both include `"../core/src/circomlibjs.d.ts"` in their `include` array. This creates a cross-package file dependency that bypasses the normal package resolution. If the core package restructures its types, these references would break silently.

**Recommendation:** Publish the `circomlibjs` type declarations as part of `@anoncitizen/core`'s `types` export, or contribute proper types to DefinitelyTyped for the `circomlibjs` package.

---

### CR-22: pako Dependency for QR Decompression (Low)

**File:** `packages/core/package.json`

`pako` (~45KB minified) is included as a full dependency for zlib decompression. Modern environments (Node.js 18+, and browsers via DecompressionStream API) have built-in zlib support.

**Recommendation:** Consider using the native `DecompressionStream` API with a `pako` fallback for older environments, to reduce bundle size for browser consumers.

---

### CR-23: Non-configurable MAX_QR_STRING_LENGTH (Low)

**File:** `packages/core/src/qr-parser.ts`, line 51

The 15,000 character limit is a module-level constant. If UIDAI changes the QR format or a legitimate QR code exceeds this limit, users have no way to override it.

**Recommendation:** Accept an optional `maxLength` parameter in `parseQRCode`, defaulting to 15,000.

---

### CR-24: Ambiguous Type Import Sources (Info)

Both `@anoncitizen/react` and `@anoncitizen/react-native` re-export core types like `ProofRequest`, `AnonCitizenProof`, `VerificationResult`, etc. Consumers may import the same type from different packages in different files, creating apparent but not actual inconsistencies.

**Recommendation:** Document the canonical import source for each type. Consider whether the re-exports are necessary or if consumers should always import types from `@anoncitizen/core`.

---

### CR-25: No Tests for React/React Native Packages (Info)

Neither `packages/react` nor `packages/react-native` have test files. The hooks and context logic are untested, relying solely on type checking for correctness.

**Recommendation:** Add at minimum smoke tests for the hooks using `@testing-library/react` (or `@testing-library/react-native`), verifying that the provider initializes correctly and hooks throw when used outside the provider.

---

### CR-26: Inconsistent Solidity Pragma (Info)

`Groth16Verifier.sol` uses `pragma solidity >=0.7.0 <0.9.0` while `AnonCitizen.sol` and `IAnonCitizen.sol` use `pragma solidity ^0.8.20`. This is standard for snarkjs-generated verifiers, but the wide pragma range on the verifier could lead to compilation with an older compiler that lacks important security fixes.

**Recommendation:** Tighten the Groth16Verifier pragma to `^0.8.20` to match the rest of the project. This requires regenerating the verifier with the appropriate snarkjs flag or manually editing the pragma after generation.

---

### CR-27: Spread Operator on Large Uint8Array in bytesToBase64url (Info)

**File:** `packages/core/src/pre-verify.ts`, line 171

```typescript
const base64 = btoa(String.fromCharCode(...bytes));
```

For RSA-2048 keys, `bytes` is 256 elements -- well within limits. However, if this function is reused for larger inputs (e.g., RSA-4096 keys at 512 bytes), the spread into `String.fromCharCode` could approach the call stack limit in some engines (~65,536 arguments).

**Recommendation:** Use a loop-based approach for safety:

```typescript
const base64 = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
```

---

### CR-28: react Missing from react-native peerDependencies (Info)

**File:** `packages/react-native/package.json`

`react` is listed in `devDependencies` but not in `peerDependencies`. Since all hooks and context use React APIs, `react` should be a peer dependency to ensure version consistency with the host application.

**Recommendation:** Add `"react": ">=19.0.0"` to `peerDependencies`.

---

## Overall Assessment

**Quality: Good -- ready for beta with fixes**

The codebase is well-organized and demonstrates strong engineering practices:

- **Architecture:** Clean separation of concerns with core logic isolated from framework-specific code. The monorepo structure with workspace dependencies is correct.
- **TypeScript:** Strict mode is enabled everywhere via `tsconfig.base.json`. Types are well-defined and comprehensive. The public API surface is well-thought-out with proper barrel exports.
- **JSDoc:** Public API functions and types have thorough JSDoc documentation with examples. Internal helpers could use more documentation.
- **Error Handling:** Generally good with descriptive error messages. The silent catch in `preVerifySignature` (CR-03) is the main concern.
- **Solidity:** The AnonCitizen contract is well-structured with proper custom errors, immutable state, and event emission. The interface-based design is clean.
- **API Design:** The SDK provides both low-level functions and a high-level `AnonCitizen` class. The React hooks follow established patterns.

**Items that should be fixed before release:**

1. **CR-01/CR-02:** Extract shared code between react and react-native packages to eliminate maintenance burden.
2. **CR-03:** Fix silent error swallowing in signature pre-verification.
3. **CR-04:** Cache the Poseidon instance to avoid expensive re-initialization.
4. **CR-05:** Implement a CI gate to prevent deployment with placeholder verification keys.
5. **CR-09:** Fix the `useState` misuse for async initialization in the React Native camera scanner.
6. **CR-12:** Add `expo-image-picker` to peerDependencies.
7. **CR-13:** Fix `Gender` re-export as value (not type-only) in react/react-native packages.

**Items that should be fixed before v1.0:**

8. **CR-07:** Add verification key schema validation.
9. **CR-10/CR-11:** Remove dead "parsing" status or add actual parsing step.
10. **CR-14:** Document or fix the file upload QR decoding gap.
11. **CR-15:** Add signalHash validation to the contract or document the caller's responsibility.
12. **CR-25:** Add tests for react and react-native packages.
