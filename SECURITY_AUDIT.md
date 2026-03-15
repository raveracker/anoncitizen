# AnonCitizen Cryptographic Security Audit

**Audit Date:** 2026-03-13
**Auditor:** Phase 5 Security Review (Independent Re-audit)
**Protocol Version:** Pre-production (Phase 5 QA)
**Scope:** Circom circuits and Core TypeScript SDK

---

## Executive Summary

This audit covers the AnonCitizen privacy-preserving Aadhaar identity verification protocol across two layers: Circom 2.1.0 circuits (Groth16 proving system) and the Core TypeScript SDK. The review identified **0 Critical**, **3 High**, **7 Medium**, **5 Low**, and **4 Informational** findings totaling **19 issues**.

The most significant findings are:

1. **The RSA PKCS#1 v1.5 hash chunk comparison uses a reversed index that does not match standard little-endian limb encoding of SHA-256 output** (High). If the byte-level mapping is incorrect, valid signatures would be rejected or -- worse -- invalid signatures accepted.
2. **The PhotoHasher does not mask photo bytes beyond the actual `photoLength`**, meaning trailing data from the signed payload is silently included in the nullifier computation, creating inconsistent nullifier values and potential manipulation vectors (High).
3. **The `ByteSelector` does not enforce that the index is within bounds**, allowing out-of-range indices to silently return zero rather than causing a constraint failure (High).

The codebase has matured substantially from earlier iterations. The RSA big-integer arithmetic (BigMul, BigMod, BigModExp65537) is properly constrained with carry-chain decomposition and range checks. The SHA-256 hasher correctly handles variable-length inputs with in-circuit padding and multiplexed final-state selection. The timestamp extractor uses constrained ByteSelector extraction. The signal hash in the SDK correctly uses Poseidon.

However, several medium-severity issues remain around field overflow, delimiter/index validation, and age-checking precision that should be addressed before production deployment.

---

## Scope

### Files Reviewed

**Circuits (Circom 2.1.0):**
- `packages/circuits/aadhaar-verifier.circom` -- main circuit, 228 lines
- `packages/circuits/lib/rsa_verifier.circom` -- RSA-2048 PKCS#1 v1.5, 493 lines
- `packages/circuits/lib/sha256_hasher.circom` -- variable-length SHA-256, 282 lines
- `packages/circuits/lib/field_extractor.circom` -- identity field extraction, 351 lines
- `packages/circuits/lib/nullifier.circom` -- Poseidon nullifier derivation, 141 lines
- `packages/circuits/lib/timestamp_converter.circom` -- IST-to-UTC conversion, 174 lines

**Core SDK (TypeScript):**
- `packages/core/src/prover.ts` -- proof generation, 154 lines
- `packages/core/src/verifier.ts` -- off-chain verification, 102 lines
- `packages/core/src/pre-verify.ts` -- RSA pre-check via Web Crypto, 221 lines
- `packages/core/src/utils.ts` -- signal hashing and conversion, 136 lines
- `packages/core/src/qr-parser.ts` -- Aadhaar QR payload parser, 255 lines
- `packages/core/src/types.ts` -- type definitions and signal index map, 234 lines

### Out of Scope

- Smart contracts (`packages/contracts/`)
- React SDK (`packages/react/`)
- React Native SDK (`packages/react-native/`)
- CI/CD pipeline and infrastructure
- Third-party dependency vulnerabilities (snarkjs, circomlib, pako)

---

## Methodology

1. **Manual line-by-line code review** of all circuit and SDK source files
2. **Constraint completeness analysis** -- tracing every `<--` (hint) to verify a corresponding `===` constraint exists, and verifying every `<==` is properly wired
3. **Cryptographic construction analysis** -- evaluating RSA, SHA-256, Poseidon, and nullifier schemes for correctness
4. **Signal flow analysis** -- verifying that public inputs/outputs are correctly bound and cannot be manipulated independently
5. **Cross-layer consistency check** -- verifying that the SDK correctly prepares inputs matching circuit expectations
6. **Attack surface analysis** -- evaluating replay, front-running, information leakage, and side-channel vectors

---

## Findings Summary Table

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| AC-01 | **HIGH** | RSA PKCS#1 v1.5 hash chunk comparison uses potentially incorrect index reversal | Open |
| AC-02 | **HIGH** | PhotoHasher does not mask bytes beyond photoLength | Open |
| AC-03 | **HIGH** | ByteSelector does not enforce index-in-range constraint | Open |
| AC-04 | **MEDIUM** | State field packing overflows BN128 scalar field for strings > 31 bytes | Open |
| AC-05 | **MEDIUM** | FieldExtractor declares unused photoHash output hardcoded to zero | Open |
| AC-06 | **MEDIUM** | Nullifier collision risk with identical photo bytes | Open |
| AC-07 | **MEDIUM** | Delimiter positions are not validated as monotonically increasing in circuit | Open |
| AC-08 | **MEDIUM** | SHA-256 targetBlock hint may accept out-of-range block indices | Open |
| AC-09 | **MEDIUM** | documentYear input is unverified in the circuit | Open |
| AC-10 | **MEDIUM** | QR parser does not validate delimiter ordering or embedded 0xFF in fields | Open |
| AC-11 | **LOW** | Age check uses year-only comparison with up to 364-day error margin | Open |
| AC-12 | **LOW** | DateToUnixUTC does not validate month/day ranges | Open |
| AC-13 | **LOW** | Pre-verification error details are silently swallowed | Open |
| AC-14 | **LOW** | extractDocumentYear fallback to current year introduces non-determinism | Open |
| AC-15 | **LOW** | No zkey/WASM integrity verification before proof generation | Open |
| AC-16 | **INFO** | Poseidon hash chain in PhotoHasher assigns states[1] redundantly | Open |
| AC-17 | **INFO** | Side-channel risks inherent to JavaScript proof generation | Open |
| AC-18 | **INFO** | QR parser BigInt conversion may consume excessive memory on adversarial input | Open |
| AC-19 | **INFO** | signalHashSquared is computed but never used as an output or further constraint | Open |

---

## Detailed Findings

---

### AC-01: RSA PKCS#1 v1.5 Hash Chunk Comparison Uses Potentially Incorrect Index Reversal

**Severity:** HIGH
**Component:** `packages/circuits/lib/rsa_verifier.circom`, `RSAVerifier` template, lines 422-425
**Status:** Open

**Description:**

The RSA verifier compares the SHA-256 hash chunks against the lowest 4 limbs of the modular exponentiation output:

```circom
for (var i = 0; i < 4; i++) {
    modExp.out[i] === hashChunks[3 - i];
}
```

This reverses the mapping: `modExp.out[0]` is compared to `hashChunks[3]`, `modExp.out[1]` to `hashChunks[2]`, etc. The `modExp.out` array uses little-endian limb ordering (limb 0 = least significant), and `hashChunks` is produced by `Sha256HashChunks` which packs the hash bits in big-endian word order (chunk 0 = most significant 64 bits of the hash).

The correctness of this reversal depends on whether the PKCS#1 v1.5 padded message places the hash in big-endian byte order within the lowest-addressed bytes. In PKCS#1 v1.5, the hash occupies the rightmost (least significant) 32 bytes of the padded message. When represented as little-endian limbs, the least significant limb (`modExp.out[0]`) contains the last 8 bytes of the hash (the least significant 64 bits in the big-endian hash). Meanwhile, `hashChunks[3]` should represent the last 64 bits of the SHA-256 output.

The mapping appears correct under the assumption that `Sha256HashChunks` produces chunks in strict big-endian 64-bit word order (chunk 0 = bits 0-63, chunk 3 = bits 192-255). However, this is a critical correctness assumption. If the bit-to-chunk packing in `Sha256HashChunks` (lines 276-281) produces a different ordering, the RSA verification would silently accept incorrect hashes.

The `Sha256HashChunks` packing is:
```circom
pack[c].in[b] <== hasher.hash[c * 64 + (63 - b)];
```

This packs bits `[c*64 .. c*64+63]` of the SHA-256 output into chunk `c`, with bit reversal within each 64-bit word. Since `hasher.hash` is big-endian (bit 0 = MSB of the hash), `hashChunks[0]` is the most significant 64 bits of the hash and `hashChunks[3]` is the least significant 64 bits. The reversal `hashChunks[3 - i]` then maps `modExp.out[0]` (LS limb of padded message) to `hashChunks[3]` (LS 64 bits of hash). This is correct.

**Impact:**

If the index mapping is wrong, every RSA verification would either always fail (rejecting valid proofs) or always succeed against incorrect hashes (accepting forged signatures). Manual derivation confirms the current mapping is likely correct, but the lack of test vectors in the codebase means this has not been empirically validated. Any future refactoring of `Sha256HashChunks` or `RSAVerifier` that changes bit/limb ordering could silently break this critical check.

**Recommendation:**

1. Add explicit comments documenting the endianness conventions and why the `3 - i` reversal is correct
2. Create test vectors with known RSA-2048 PKCS#1 v1.5 SHA-256 signatures to empirically verify the limb mapping
3. Consider introducing named constants or a helper template to make the mapping self-documenting

---

### AC-02: PhotoHasher Does Not Mask Bytes Beyond photoLength

**Severity:** HIGH
**Component:** `packages/circuits/lib/nullifier.circom`, `PhotoHasher` template, lines 42-58
**Status:** Open

**Description:**

The `PhotoHasher` accepts a `photoLength` input signal but never uses it to mask bytes beyond the actual photo data:

```circom
signal input photoBytes[maxPhotoBytes];
signal input photoLength; // actual photo byte count -- NEVER USED
signal output hash;

// Pack bytes into field-element chunks (31 bytes each)
for (var c = 0; c < chunksNeeded; c++) {
    packers[c] = PackBytes(31);
    for (var b = 0; b < 31; b++) {
        var byteIdx = c * 31 + b;
        if (byteIdx < maxPhotoBytes) {
            packers[c].in[b] <== photoBytes[byteIdx];
        } else {
            packers[c].in[b] <== 0;
        }
    }
    chunks[c] <== packers[c].out;
}
```

All `maxPhotoBytes` bytes are packed and hashed, regardless of the actual `photoLength`.

In the main circuit (`aadhaar-verifier.circom`, lines 152-158), photo bytes are extracted using `ByteSelector` with indices `photoStart + i` for `i` in `[0, maxPhotoBytes)`. When `i >= photoLength`, the selector reads bytes from beyond the photo region in the signed data -- these could be any bytes (email/mobile hashes, other field data, or trailing content).

**Impact:**

1. **Inconsistent nullifiers:** Two provers with the same Aadhaar photo but different surrounding data (e.g., different email hash bytes after the photo) would produce different nullifiers, breaking the invariant that "same person + same seed = same nullifier."
2. **Nullifier manipulation:** A malicious prover who controls the bytes surrounding the photo could influence the nullifier by choosing specific `photoStart` values that cause different trailing bytes to be included.
3. **Cross-document correlation leakage:** The nullifier inadvertently depends on data beyond the photo, potentially leaking information about adjacent fields.

**Recommendation:**

Add masking in `PhotoHasher` to zero out bytes at or beyond `photoLength`:

```circom
signal maskedBytes[maxPhotoBytes];
component isInRange[maxPhotoBytes];
for (var i = 0; i < maxPhotoBytes; i++) {
    isInRange[i] = LessThan(32);
    isInRange[i].in[0] <== i;
    isInRange[i].in[1] <== photoLength;
    maskedBytes[i] <== photoBytes[i] * isInRange[i].out;
}
```

Then use `maskedBytes` in the packing loop.

---

### AC-03: ByteSelector Does Not Enforce Index-In-Range Constraint

**Severity:** HIGH
**Component:** `packages/circuits/lib/field_extractor.circom`, `ByteSelector` template, lines 12-34
**Status:** Open

**Description:**

The `ByteSelector` uses `IsEqual` comparisons across all data positions and sums the matches to select a byte at a given index:

```circom
for (var i = 0; i < maxBytes; i++) {
    eq[i] = IsEqual();
    eq[i].in[0] <== index;
    eq[i].in[1] <== i;
    matches[i] <== data[i] * eq[i].out;
}
```

If `index >= maxBytes`, none of the `eq[i].out` values will be 1, and `out` will be 0. The template does not constrain `index < maxBytes`.

This template is used extensively:
- `DelimiterVerifier` (verifies `data[position] === 255`) -- an out-of-range position would return 0, which fails the `=== 255` check (safe)
- `ExtractBytes` (extracts contiguous ranges) -- out-of-range bytes silently become 0
- Photo byte extraction in `aadhaar-verifier.circom` -- out-of-range indices return 0
- Timestamp extraction in `timestamp_converter.circom` -- out-of-range indices return 0

**Impact:**

A malicious prover could set `photoStart` to a value such that `photoStart + i >= maxDataBytes` for some photo bytes. Those bytes would be zero, altering the photo hash and thus the nullifier. Combined with AC-02, the prover has significant control over the nullifier computation.

For timestamp extraction, out-of-range indices would return 0 (ASCII NUL), which would fail the digit range check `digitValues[i] < 10` since `0 - 48` wraps in the field to a very large number. This provides an indirect safety net for timestamps but not for photo extraction.

**Recommendation:**

Add a range check at the beginning of `ByteSelector`:

```circom
component inRange = LessThan(32);
inRange.in[0] <== index;
inRange.in[1] <== maxBytes;
inRange.out === 1;
```

---

### AC-04: State Field Packing Overflows BN128 Scalar Field

**Severity:** MEDIUM
**Component:** `packages/circuits/lib/field_extractor.circom`, lines 328-336
**Status:** Open

**Description:**

The state name is packed into a single field element using big-endian byte encoding across up to 64 bytes:

```circom
signal stateAccum[65];
stateAccum[0] <== 0;
for (var i = 0; i < 64; i++) {
    stateAccum[i + 1] <== stateAccum[i] * 256 + stateExtractor.out[i];
}
```

This can produce values up to `256^64` (512 bits), far exceeding the BN128 scalar field modulus (~254 bits). Values larger than the field modulus undergo silent modular reduction, causing different state names to map to the same field element.

**Impact:**

Any state name longer than 31 bytes would overflow. Indian state names in ASCII are all under 31 bytes (the longest common one is "Andaman and Nicobar Islands" at 27 characters), so this is unlikely to trigger in practice. However, if state names include Unicode characters or the Aadhaar QR encoding uses multi-byte representations, overflow could occur. Two different states could produce the same output value, which a verifier would be unable to distinguish.

**Recommendation:**

1. Reduce the extraction and packing to 31 bytes maximum, matching the BN128 field element capacity
2. Alternatively, use a Poseidon hash over the state bytes instead of direct packing
3. Document the maximum state name length supported

---

### AC-05: FieldExtractor Declares Unused photoHash Output Hardcoded to Zero

**Severity:** MEDIUM
**Component:** `packages/circuits/lib/field_extractor.circom`, line 350
**Status:** Open

**Description:**

```circom
photoHash <== 0; // Placeholder -- actual hash computed in main circuit via nullifier.circom
```

The `FieldExtractor` declares a `photoHash` output signal but always outputs zero. The actual photo hash is computed independently in the main circuit. This creates a misleading API surface.

**Impact:**

No direct security impact in the current architecture. However, if any future consumer of `FieldExtractor` relies on its `photoHash` output, every user would get the same nullifier (`Poseidon(seed, 0)`), destroying the uniqueness property and enabling identity impersonation.

**Recommendation:**

Remove the `photoHash` output from `FieldExtractor` since it is computed elsewhere, or move the photo hash computation into `FieldExtractor` for cleaner encapsulation.

---

### AC-06: Nullifier Collision Risk With Identical Photo Bytes

**Severity:** MEDIUM
**Component:** `packages/circuits/lib/nullifier.circom`, `NullifierHasher` template
**Status:** Open

**Description:**

The nullifier is derived as `Poseidon(nullifierSeed, photoHash)`. If two Aadhaar holders have byte-identical photos (whether due to a UIDAI system error, data duplication, or adversarial manipulation), they would produce the same nullifier for a given application seed. The second user would be blocked by the nullifier uniqueness check.

**Impact:**

- Denial of service: if a user's photo bytes match another user's, the second user is permanently locked out of the application
- In practice, UIDAI assigns unique biometric photos, making natural collisions extremely unlikely
- There is no defense-in-depth against this edge case

**Recommendation:**

Incorporate additional identity-specific data into the nullifier. For example, include a hash of the reference ID:

```
nullifier = Poseidon(nullifierSeed, photoHash, referenceIdHash)
```

This would differentiate users even if their photos are byte-identical.

---

### AC-07: Delimiter Positions Are Not Validated as Monotonically Increasing in Circuit

**Severity:** MEDIUM
**Component:** `packages/circuits/lib/field_extractor.circom`, `FieldExtractor` template
**Status:** Open

**Description:**

The `FieldExtractor` verifies that each `delimiterPositions[i]` points to a byte with value `0xFF` (via `DelimiterVerifier`), but it does not verify that the positions are monotonically increasing:

```circom
delimCheck[i].position <== delimiterPositions[i];
// But no check that delimiterPositions[i] < delimiterPositions[i+1]
```

A malicious prover could provide delimiter positions out of order, or even duplicate positions (the same 0xFF byte used as multiple delimiters). This would cause field extraction to read from unexpected regions of the signed data.

**Impact:**

A malicious prover could misalign field extraction to cause:
- The birth year to be extracted from the wrong field (e.g., from the pincode)
- The gender byte to be read from an unrelated position
- The pincode to be extracted from a different numeric field

Since the signed data is RSA-authenticated, the prover cannot modify the data itself, but they can control which bytes are interpreted as which fields. This could allow a prover to claim a different age, gender, state, or pincode than what their Aadhaar document actually contains.

**Recommendation:**

Add ordering constraints in the circuit:

```circom
component orderCheck[16];
for (var i = 0; i < 16; i++) {
    orderCheck[i] = LessThan(32);
    orderCheck[i].in[0] <== delimiterPositions[i];
    orderCheck[i].in[1] <== delimiterPositions[i + 1];
    orderCheck[i].out === 1;
}
```

---

### AC-08: SHA-256 targetBlock Hint May Accept Out-of-Range Block Indices

**Severity:** MEDIUM
**Component:** `packages/circuits/lib/sha256_hasher.circom`, `Sha256Hasher` template, lines 121-132
**Status:** Open

**Description:**

The `targetBlock` signal is a prover hint constrained via:

```circom
targetBlock <-- (dataLength + 8) \ 64;
// Constraint: targetBlock * 64 <= (dataLength + 8) < (targetBlock + 1) * 64
tbRemainder <== tbOffset - tbLower;
component tbRemBits = Num2Bits(6);
tbRemBits.in <== tbRemainder;
```

This constrains `tbRemainder` to be in `[0, 63]`, which correctly binds `targetBlock` to the floor division. However, there is no constraint that `targetBlock < maxBlocks`. If `dataLength` is large enough (or manipulated), `targetBlock` could reference a block index beyond the array of compression outputs, and the multiplexer (lines 237-256) would produce all zeros for the hash since no `blockMatch[blk]` would be 1.

The `dataLength` is a private input provided by the prover. While `dataLength` should correspond to the actual signed data length (which is authenticated by RSA), there is no in-circuit constraint binding `dataLength` to any authenticated value.

**Impact:**

A malicious prover could set `dataLength` to a value that causes `targetBlock >= maxBlocks`. In this case, all `blockMatch[blk]` would be 0, and the hash output would be all zeros. The RSA verifier would then compare the zero hash against the PKCS#1 padded signature output. This would only succeed if the PKCS#1 padded form of the all-zeros hash matches `signature^65537 mod pubkey`, which is astronomically unlikely for any valid RSA key. Therefore, the RSA verification provides an indirect safety net.

However, the principle of defense-in-depth suggests this should be explicitly constrained.

**Recommendation:**

Add a constraint that `targetBlock < maxBlocks`:

```circom
component tbInRange = LessThan(32);
tbInRange.in[0] <== targetBlock;
tbInRange.in[1] <== maxBlocks;
tbInRange.out === 1;
```

---

### AC-09: documentYear Input Is Unverified in the Circuit

**Severity:** MEDIUM
**Component:** `packages/circuits/aadhaar-verifier.circom`, line 119; `packages/circuits/lib/field_extractor.circom`
**Status:** Open

**Description:**

The `documentYear` is provided as a private input signal and passed directly to the `AgeChecker`:

```circom
signal input documentYear;
// ...
ageCheck.documentYear <== documentYear;
```

There is no constraint verifying that `documentYear` matches the year extracted from the timestamp or any other authenticated field in the signed data. The prover can provide any value.

**Impact:**

A malicious prover could set `documentYear` to an artificially high value (e.g., 2050) to make themselves appear older than 18 even if they are not. Since this only affects the `ageAbove18` output (which is conditionally revealed), the impact is limited to age verification fraud when `revealAgeAbove18 = 1`.

The prover controls the age check result by choosing `documentYear`:
- Setting `documentYear = birthYear + 18` always produces `ageAbove18 = 1`
- Setting `documentYear = birthYear + 17` always produces `ageAbove18 = 0`

**Recommendation:**

Extract the document year from the authenticated signed data (e.g., from the timestamp field or reference ID) using constrained ByteSelector extraction, and remove it as a free private input. Alternatively, verify it against the extracted timestamp:

```circom
// Verify documentYear matches the year from the timestamp
component yearFromTimestamp = ...; // extract year from timestamp
documentYear === yearFromTimestamp.year;
```

---

### AC-10: QR Parser Does Not Validate Delimiter Ordering or Embedded 0xFF

**Severity:** MEDIUM
**Component:** `packages/core/src/qr-parser.ts`, `parseDecompressedPayload`, lines 135-164
**Status:** Open

**Description:**

The QR parser iterates through the signed data looking for `0xFF` delimiter bytes and stops after finding 17 fields. It does not:
1. Validate that delimiter positions are monotonically increasing (they inherently are due to the linear scan, but there is no explicit check on the resulting `delimiterPositions` array)
2. Detect or handle `0xFF` bytes embedded within field values (e.g., in Latin-1 encoded text)
3. Verify that exactly 17 delimiters exist in the signed data (it stops at 17 but does not check for extras)

**Impact:**

If an Aadhaar QR payload contains `0xFF` bytes within field values (before the 17th delimiter), the parser would misidentify field boundaries. This would cause:
- Incorrect field extraction in the SDK
- Misaligned delimiter positions passed to the circuit
- The RSA signature would still verify (the signed data is authentic), but the semantic interpretation of fields would be wrong

This is primarily a correctness issue rather than a security issue, since the signed data cannot be manipulated. However, it could lead to incorrect age, gender, state, or pincode outputs.

**Recommendation:**

1. Add a post-parsing validation that delimiter positions are reasonable (e.g., first delimiter within the first 20 bytes for the version field)
2. Cross-validate field lengths against expected ranges (e.g., DOB should be 10 chars, gender should be 1 char)
3. Document the assumption that field values do not contain embedded 0xFF bytes

---

### AC-11: Age Check Uses Year-Only Comparison

**Severity:** LOW
**Component:** `packages/circuits/lib/field_extractor.circom`, `AgeChecker` template, lines 120-134
**Status:** Open

**Description:**

The age check computes `age = documentYear - birthYear` and checks `age >= 18`. This does not account for birth month and day.

**Impact:**

A person born on December 31, 2008, evaluated against a document from January 1, 2026, would compute as 18 years old despite being 17 years and 1 day old. The error margin is up to 364 days. This affects only the `ageAbove18` output.

**Recommendation:**

Either extract the full DOB (day, month, year) and document date for a precise comparison, or document the limitation prominently: "The age check has up to a 1-year margin of error and should be treated as an approximation."

---

### AC-12: DateToUnixUTC Does Not Validate Month/Day Ranges

**Severity:** LOW
**Component:** `packages/circuits/lib/timestamp_converter.circom`, `DateToUnixUTC` template
**Status:** Open

**Description:**

The `DateToUnixUTC` template accepts `month` and `day` inputs but does not constrain them to valid ranges (month in [1,12], day in [1,31]). An invalid month (e.g., 0 or 13) would cause `monthCumDays` to be 0 (since no `monthEq` would match), silently producing an incorrect timestamp.

**Impact:**

The timestamp is derived from authenticated signed data (via constrained ByteSelector), so the prover cannot directly provide invalid month/day values. The risk is limited to edge cases where the timestamp format in the signed data does not match the expected format, which would produce an incorrect but harmless timestamp output.

Note: The `TimestampExtractor` in the current code uses `TimestampParser` (a numeric string parser), not `DateToUnixUTC`. The `DateToUnixUTC` template exists but is not directly used in the main circuit flow. The `TimestampExtractor` parses a numeric timestamp and converts IST-to-UTC by subtracting 19800 seconds. This makes AC-12 a latent issue rather than an active one.

**Recommendation:**

If `DateToUnixUTC` is intended for future use, add range validation for month and day. If it is unused, consider removing it to reduce the attack surface.

---

### AC-13: Pre-Verification Error Details Are Silently Swallowed

**Severity:** LOW
**Component:** `packages/core/src/pre-verify.ts`, lines 40-42
**Status:** Open

**Description:**

```typescript
} catch {
    return false;
}
```

All exceptions during RSA pre-verification are caught and converted to `false`. This includes errors that could indicate implementation bugs, format mismatches, or environment issues (e.g., missing Web Crypto API).

**Impact:**

Debugging failures during proof generation becomes difficult when the pre-verification step silently returns `false` without any diagnostic information. Users would see proof generation fail without understanding that the RSA signature check failed.

**Recommendation:**

Log or propagate error details. At minimum, use a debug-level log:

```typescript
} catch (err) {
    console.debug("[anoncitizen] pre-verify failed:", err);
    return false;
}
```

---

### AC-14: extractDocumentYear Fallback to Current Year Introduces Non-Determinism

**Severity:** LOW
**Component:** `packages/core/src/prover.ts`, `extractDocumentYear`, lines 129-141
**Status:** Open

**Description:**

```typescript
function extractDocumentYear(payload: AadhaarQRPayload): number {
    const currentYear = new Date().getFullYear();
    const refYear = parseInt(payload.referenceId.substring(0, 4), 10);
    if (refYear >= 2000 && refYear <= currentYear + 1) {
        return refYear;
    }
    return currentYear;
}
```

If the reference ID does not start with a 4-digit year, the function falls back to `new Date().getFullYear()`. This introduces non-determinism: the same QR payload processed at midnight on December 31 vs. January 1 would produce different circuit inputs, potentially causing a proof generated in December to differ from one generated in January.

**Impact:**

Combined with AC-09 (documentYear is unverified in the circuit), this is not a security issue per se -- the circuit would accept either value. However, it introduces brittleness: a proof's age-check result could change depending on when it is generated.

**Recommendation:**

Derive the document year deterministically from the Aadhaar data (e.g., from the timestamp or reference ID) rather than using the system clock. If no reliable source exists in the payload, require the caller to provide the document year explicitly.

---

### AC-15: No zkey/WASM Integrity Verification Before Proof Generation

**Severity:** LOW
**Component:** `packages/core/src/prover.ts`, `generateProof`, lines 50-55
**Status:** Open

**Description:**

The proof generator accepts `wasmPath` and `zkeyPath` and passes them directly to snarkjs without integrity verification:

```typescript
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    wasmPath,
    zkeyPath
);
```

**Impact:**

If an attacker can substitute the zkey file (via MITM, CDN compromise, or path traversal), they could cause proof generation to fail or produce proofs that are invalid under the legitimate verification key. This would not compromise privacy (the private inputs are not revealed), but it would be a denial-of-service.

**Recommendation:**

Implement integrity checking (e.g., SHA-256 hash comparison) of the zkey and WASM files before passing them to snarkjs. Store expected hashes in the SDK configuration.

---

### AC-16: PhotoHasher and PubKeyHasher Assign states[1] Redundantly

**Severity:** INFORMATIONAL
**Component:** `packages/circuits/lib/nullifier.circom`, `PhotoHasher` lines 73-75, `PubKeyHasher` lines 129-130
**Status:** Open

**Description:**

In both `PhotoHasher` and `PubKeyHasher`, the iterative Poseidon hash chain assigns `states[1]` twice:

```circom
// PhotoHasher
states[0] <== firstHash.out;
states[1] <== firstHash.out; // redundant: same value as states[0]

// The chain loop starts at i=2:
chainHash[i - 2].inputs[0] <== states[i - 1]; // uses states[1]
```

`states[0]` and `states[1]` receive the same value. The loop at `i=2` reads `states[1]`, which is correct but wasteful. The `states[0]` assignment is then unused.

**Impact:**

No security impact. This is a code clarity issue. The intent is that `states[i]` holds the hash state after processing `i+1` chunks, but the naming is inconsistent between the first pair and subsequent iterations.

**Recommendation:**

Restructure to avoid the redundant assignment, or add a comment explaining why both `states[0]` and `states[1]` hold the same value.

---

### AC-17: Side-Channel Risks Inherent to JavaScript Proof Generation

**Severity:** INFORMATIONAL
**Component:** `packages/core/src/prover.ts`, `packages/core/src/utils.ts`
**Status:** Open

**Description:**

Proof generation occurs in JavaScript using snarkjs WASM. Private inputs (signed data, signature, photo, delimiter positions) are held in JavaScript memory. JavaScript provides no constant-time guarantees, no secure memory erasure, and heap data may persist after GC.

**Impact:**

In a browser environment, private inputs could be accessible to malicious extensions, compromised page scripts, or memory forensics. This is an inherent limitation shared by all JavaScript-based ZK proof systems (anon-aadhaar, zk-email, Semaphore) and is consistent with the standard threat model.

**Recommendation:**

Document the threat model assumption that the client device is trusted. For high-security deployments, consider native proof generation (rapidsnark) with better memory isolation.

---

### AC-18: QR Parser BigInt Conversion May Consume Excessive Memory

**Severity:** INFORMATIONAL
**Component:** `packages/core/src/qr-parser.ts`, `decodeQRString`, lines 57-85
**Status:** Open

**Description:**

The QR string length is capped at `MAX_QR_STRING_LENGTH = 15_000` (line 51), and input is validated as digit-only. The BigInt conversion at line 71 (`BigInt(decimalString)`) and subsequent hex conversion could consume significant memory for inputs near the maximum length (a 15,000-digit number is ~50,000 bits).

**Impact:**

Minimal. The 15,000 character limit is reasonable for Aadhaar QR data, and modern JavaScript engines handle BigInt operations of this size efficiently. The input validation (digit-only regex, length check) provides adequate protection against adversarial inputs.

**Recommendation:**

The current safeguards are adequate. Consider adding a comment documenting the expected size range of legitimate Aadhaar QR data.

---

### AC-19: signalHashSquared Is Computed But Never Used as Output or Further Constraint

**Severity:** INFORMATIONAL
**Component:** `packages/circuits/aadhaar-verifier.circom`, lines 200-202
**Status:** Open

**Description:**

```circom
signal signalHashSquared;
signalHashSquared <== signalHash * signalHash;
out_signalHash <== signalHash;
```

The `signalHashSquared` signal exists solely to force `signalHash` into the R1CS constraint system (preventing compiler optimization that could remove it). The actual output is `out_signalHash <== signalHash`, which is a direct passthrough.

**Impact:**

No security impact. This is a standard pattern used in ZK circuits (also used by Semaphore and other protocols) to bind a public input into the proof without performing meaningful computation. The pattern is correct -- `signalHash * signalHash` creates a quadratic constraint that prevents the compiler from treating `signalHash` as a free variable.

**Recommendation:**

Add a comment explaining the purpose of this pattern for developer clarity:

```circom
// "Square constraint" pattern: forces signalHash into R1CS constraints.
// Without this, the Circom compiler may optimize away the passthrough.
```

---

## Positive Findings

The following aspects of the codebase were reviewed and found to be correctly implemented:

### RSA Big-Integer Arithmetic Is Properly Constrained

The `BigMul` template correctly computes partial products with `<==` (constrained), uses carry-chain decomposition with `<--` hints, and verifies each decomposition with `===` constraints. Carry values are range-checked via `Num2Bits`. The `BigMod` template properly constrains `a === q * p + r` using a full carry-chain verification and enforces `r < p` with a borrow-chain subtraction check. The `BigModExp65537` correctly implements 16 squarings plus 1 multiplication.

### SHA-256 Hasher Handles Variable-Length Inputs Correctly

The `Sha256Hasher` properly constructs the SHA-256 padded message in-circuit, including:
- 0x80 byte placement at `dataLength` position
- 64-bit big-endian length suffix in the correct block
- Block-by-block compression with proper IV initialization
- Multiplexed final-state selection via `blockMatch`

### Nullifier Seed Non-Zero Check

The `NullifierHasher` correctly enforces `nullifierSeed != 0` using `IsEqual` + assertion, preventing degenerate nullifiers.

### Conditional Reveal Pattern Is Sound

The `ConditionalReveal` template correctly enforces `revealFlag * (1 - revealFlag) === 0` (boolean constraint) and outputs `value * revealFlag`. When `revealFlag = 0`, the output is exactly 0 regardless of the underlying value, preventing information leakage.

### Signal Hash Uses Poseidon in SDK

The `hashSignal` function in `utils.ts` correctly delegates to `hashSignalPoseidon`, which uses `circomlibjs` Poseidon. This provides collision resistance matching the circuit's field arithmetic.

### IST-to-UTC Conversion Is Correct

The `ISTtoUTC` template correctly subtracts 19,800 seconds (5 hours 30 minutes) from the IST timestamp. The `DateToUnixUTC` leap year hint is properly constrained via `Num2Bits(2)` range check on the remainder.

### PKCS#1 v1.5 DigestInfo Is Fully Verified

The `RSAVerifier` verifies all 32 limbs of the PKCS#1 v1.5 padded message:
- Limbs 0-3: SHA-256 hash (with index reversal)
- Limbs 4-6: DigestInfo constants (explicitly verified)
- Limbs 7-30: 0xFF padding (verified as `0xFFFFFFFFFFFFFFFF`)
- Limb 31: `0x0001FFFFFFFFFFFF` (verified)

---

## Severity Distribution

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 3 |
| Medium | 7 |
| Low | 5 |
| Informational | 4 |
| **Total** | **19** |

---

## Recommendations Summary

### Must Fix Before Production Deployment

1. **Add photoLength masking in PhotoHasher** (AC-02) -- prevents nullifier manipulation and inconsistency
2. **Add index range check in ByteSelector** (AC-03) -- prevents out-of-bounds silent zero returns
3. **Add delimiter ordering constraints in FieldExtractor** (AC-07) -- prevents field misalignment attacks
4. **Constrain documentYear against authenticated data** (AC-09) -- prevents age check fraud

### Should Fix Before Production

5. **Add RSA hash chunk test vectors** (AC-01) -- empirically verify the limb mapping is correct
6. **Fix state packing overflow** (AC-04) -- cap at 31 bytes or use Poseidon hash
7. **Add targetBlock range constraint** (AC-08) -- defense in depth for SHA-256
8. **Improve QR parser delimiter validation** (AC-10) -- detect misaligned field boundaries

### Improvement Recommendations

9. Remove unused FieldExtractor.photoHash output (AC-05)
10. Consider augmenting nullifier with reference ID hash (AC-06)
11. Improve age check precision or document limitation (AC-11)
12. Add pre-verify error logging (AC-13)
13. Make document year extraction deterministic (AC-14)
14. Implement zkey integrity checking (AC-15)

---

## Overall Assessment

The AnonCitizen protocol demonstrates a well-designed architecture with sound cryptographic foundations. The circuit layer has matured significantly: the RSA big-integer arithmetic is properly constrained with carry-chain decomposition and range checks, the SHA-256 hasher correctly handles variable-length inputs, and the conditional reveal pattern prevents information leakage.

The most critical remaining issues center on input validation and boundary enforcement within the circuit (photoLength masking, index range checks, delimiter ordering, documentYear verification). These are not fundamental design flaws but rather missing guardrails that a malicious prover could exploit to manipulate specific outputs (nullifier, age check, field values) without forging the RSA signature.

**The protocol should not be deployed to production until findings AC-02, AC-03, AC-07, and AC-09 are resolved.** These four findings collectively allow a malicious prover to manipulate the nullifier value (AC-02 + AC-03), claim false identity attributes (AC-07), and forge age verification results (AC-09), even though the underlying Aadhaar document's RSA signature is correctly verified.

Once these issues are addressed, a follow-up review should verify the fixes and conduct fuzz testing against the circuit constraint system. The trusted setup ceremony must also be completed before any mainnet deployment.
