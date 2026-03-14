# Phase 1 — Circuit I/O Schema

## Circuit: `aadhaar-verifier`

This document defines the exact signal schema for the main `aadhaar-verifier` Circom circuit, mapped directly from the `docs/proving_flow.png` diagram and `docs/requirements.md`.

---

## 1. Private Inputs

These signals are known only to the prover and are never revealed.

| Signal Name | Type | Size | Description |
|-------------|------|------|-------------|
| `signedData[N]` | `signal input` | Array of field elements, N chunks | The signed data bytes extracted from the Aadhaar QR code. Contains all identity fields + photo. Chunked into field-sized elements (each ≤ 253 bits for BN128). Total raw size: variable, typically 2-10 KB. |
| `signature[K]` | `signal input` | Array of K field elements (K = 32 for 2048-bit RSA with 64-bit limbs) | The RSA signature bytes (256 bytes / 2048 bits). Represented as big-integer limbs for in-circuit RSA verification. |

### Sizing Notes

- **Signed data**: Aadhaar QR signed data is variable-length. The circuit must be parameterized for a maximum length. Typical max: ~10,000 bytes → padded and chunked for SHA-256 (512-bit blocks).
- **RSA signature**: Fixed 2048-bit (256 bytes). Represented as 32 × 64-bit limbs (matching circom-rsa-verify conventions).
- **Field capacity**: BN128 scalar field is ~254 bits. Each signal holds at most 253 bits of data.

---

## 2. Public Inputs

These signals are provided by the application and are visible to the verifier.

| Signal Name | Type | Size | Description |
|-------------|------|------|-------------|
| `pubKey[K]` | `signal input` | Array of K field elements (K = 32) | UIDAI RSA public key modulus (2048-bit). Same limb representation as signature. |
| `signalHash` | `signal input` | 1 field element | Poseidon hash of the application signal. Defaults to `Poseidon("1")` if no signal is provided. Binds the proof to a specific action. |
| `nullifierSeed` | `signal input` | 1 field element | Application-specific seed for nullifier derivation. Different apps use different seeds to prevent cross-app tracking. |
| `revealAgeAbove18` | `signal input` | 1 field element (0 or 1) | Boolean flag: if 1, the circuit outputs whether the holder is above 18. If 0, the ageAbove18 output is constrained to 0. |
| `revealGender` | `signal input` | 1 field element (0 or 1) | Boolean flag: if 1, the circuit outputs the gender field. If 0, the gender output is constrained to 0. |
| `revealState` | `signal input` | 1 field element (0 or 1) | Boolean flag: if 1, the circuit outputs the state field. If 0, the state output is constrained to 0. |
| `revealPinCode` | `signal input` | 1 field element (0 or 1) | Boolean flag: if 1, the circuit outputs the pincode. If 0, the pincode output is constrained to 0. |

### Constraints on Public Inputs

- `revealAgeAbove18`, `revealGender`, `revealState`, `revealPinCode` must each be binary: `x * (1 - x) === 0`
- `signalHash` must be non-zero (prevents null signal binding)
- `nullifierSeed` must be non-zero (prevents degenerate nullifiers)

---

## 3. Outputs

### Always-Present Outputs

These are always computed and included in the public signals, regardless of reveal flags.

| Signal Name | Type | Description | Derivation |
|-------------|------|-------------|------------|
| `nullifier` | `signal output` | Unique identifier for this user-app pair. Prevents double-proving. | `Poseidon(nullifierSeed, photoHash)` where `photoHash = Poseidon(photoBytes...)` |
| `timestamp` | `signal output` | UNIX UTC timestamp of the Aadhaar document issuance/generation. | Extracted from signed data (IST format), converted: `unixUTC = istTimestamp - 19800` (5h30m in seconds) |
| `pubKeyHash` | `signal output` | Hash of the RSA public key used for verification. Allows verifiers to check the proof was generated with a known UIDAI key. | `Poseidon(pubKey[0], pubKey[1], ..., pubKey[K-1])` |
| `signalHash` | `signal output` | Echo of the input signalHash. Passed through to allow the verifier to confirm the signal binding. | Direct passthrough with constraint: `signalHash_out === signalHash_in` (via `signalHash * signalHash === signalHash * signalHash` or similar square constraint) |
| `nullifierSeed` | `signal output` | Echo of the input nullifierSeed. Passed through so verifiers can confirm which app-seed was used. | Direct passthrough with constraint. |

### Conditionally-Revealed Outputs

These outputs are only meaningful when the corresponding `reveal*` flag is set to 1. When the flag is 0, the output is constrained to 0.

| Signal Name | Type | Description | Derivation | Encoding |
|-------------|------|-------------|------------|----------|
| `ageAbove18` | `signal output` | Whether the holder is above 18 years of age. | Extract DOB from signed data, compute `currentTimestamp - dobTimestamp > 18 years`. Output = `result * revealAgeAbove18`. | 0 = not revealed or under 18, 1 = above 18 (only meaningful when `revealAgeAbove18 = 1`) |
| `gender` | `signal output` | Gender field from the Aadhaar document. | Extract gender byte from signed data at known offset. Output = `genderValue * revealGender`. | 0 = not revealed, 1 = Male, 2 = Female, 3 = Other (only meaningful when `revealGender = 1`) |
| `state` | `signal output` | State field from the Aadhaar document. | Extract state string from signed data, encode as a numeric identifier (hash or lookup index). Output = `stateValue * revealState`. | 0 = not revealed, else numeric state code (only meaningful when `revealState = 1`) |
| `pinCode` | `signal output` | PIN code from the Aadhaar address. | Extract 6-digit pincode from signed data. Output = `pincodeValue * revealPinCode`. | 0 = not revealed, else 6-digit integer (only meaningful when `revealPinCode = 1`) |

### Conditional Reveal Pattern

```
// For each optional field:
signal extracted_value;  // computed from signed data
signal output revealed;
revealed <== extracted_value * revealFlag;
```

When `revealFlag = 0`, `revealed = 0` regardless of the actual value — the verifier learns nothing.
When `revealFlag = 1`, `revealed = extracted_value` — the verifier sees the real value.

---

## 4. Circuit Operations (Processing Pipeline)

Mapped directly from the proving_flow diagram, left to right:

### Stage 1: SHA-256 Hash of Signed Data

```
Input:  signedData[N] (private)
Output: dataHash[256] (internal — 256-bit hash as bit array)

Operation:
  1. Convert signedData chunks back to bytes
  2. Pad to SHA-256 block boundary (512-bit blocks)
  3. Apply SHA-256 circuit (from circomlib or custom)
  4. Produce 256-bit hash
```

**Sub-circuit:** `Sha256Hasher(maxDataBytes)`
**Estimated constraints:** ~30,000 per SHA-256 block (512 bits). For 10KB input ≈ 160 blocks → ~4.8M constraints for SHA-256 alone.

### Stage 2: RSA Signature Verification

```
Input:  dataHash (from Stage 1), signature[K] (private), pubKey[K] (public)
Output: rsaValid (internal boolean — must be 1)

Operation:
  1. Compute signature^65537 mod pubKey (RSA verification with e=65537)
  2. Apply PKCS#1 v1.5 padding check
  3. Compare recovered hash with dataHash
  4. Constrain: recovered_hash === dataHash
```

**Sub-circuit:** `RSAVerifier(keyBits=2048, limbSize=64)`
**Estimated constraints:** ~150,000-300,000 (big-integer modular exponentiation)

### Stage 3: Field Extraction from Signed Data

```
Input:  signedData[N] (private), field delimiter positions
Output: photoBytes, dobValue, genderValue, stateValue, pincodeValue (internal)

Operation:
  1. Parse signed data byte array at known offsets/delimiters
  2. Extract photo bytes (variable length, at end of signed data before signature)
  3. Extract DOB bytes → convert to timestamp
  4. Extract gender byte
  5. Extract state string → numeric encoding
  6. Extract pincode (6 digits)
```

**Sub-circuit:** `FieldExtractor(maxDataBytes, fieldCount)`
**Note:** Field offsets are determined by delimiter bytes (0xFF separator in Aadhaar QR v2). The circuit must locate delimiters and extract fields positionally.

### Stage 4: Nullifier Computation

```
Input:  nullifierSeed (public), photoBytes (from Stage 3)
Output: nullifier (public output)

Operation:
  1. photoHash = Poseidon(photoBytes[0..chunk_count])
     (photo bytes chunked into field elements for Poseidon)
  2. nullifier = Poseidon(nullifierSeed, photoHash)
```

**Sub-circuit:** `NullifierHasher(maxPhotoChunks)`
**Estimated constraints:** ~300-600 per Poseidon hash invocation. With chunked photo: ~5,000-10,000 total.

**Design decision (ADR-002):** Poseidon is used instead of SHA-256 for nullifier hashing because:
- Poseidon: ~300 constraints per hash vs SHA-256: ~30,000 constraints per hash
- Nullifier doesn't need to match any external standard — it's protocol-internal
- Poseidon is the standard choice for in-circuit hashing in ZK protocols

### Stage 5: Timestamp Conversion (IST → UNIX UTC)

```
Input:  raw timestamp from signed data (IST)
Output: timestamp (public output — UNIX UTC)

Operation:
  1. Parse IST timestamp components from signed data
     (Aadhaar QR stores timestamp as a numeric string or packed integer)
  2. Convert to UNIX seconds
  3. Subtract IST offset: UTC = IST - 19800  (5 hours 30 minutes = 19800 seconds)
```

**Sub-circuit:** `TimestampConverter()`
**Estimated constraints:** Minimal (~100-500) — basic arithmetic operations.

**Note:** The IST offset (19800 seconds) is a constant hardcoded in the circuit. The timestamp in the Aadhaar QR is the document generation time, not current time.

### Stage 6: Signal Hash Binding

```
Input:  signalHash (public input)
Output: signalHash (public output — passthrough with constraint)

Operation:
  1. Apply a constraint that forces the signal into the proof:
     signalHash * signalHash === signalHash * signalHash
     (This is the standard "square constraint" pattern used to bind a public
      input without performing any transformation on it)
```

**Estimated constraints:** 1

---

## 5. Total Constraint Estimate

| Stage | Operation | Estimated Constraints |
|-------|-----------|----------------------|
| 1 | SHA-256 of signed data (~10KB) | ~4,800,000 |
| 2 | RSA-2048 verification | ~200,000 |
| 3 | Field extraction + parsing | ~50,000 |
| 4 | Nullifier (Poseidon hashing) | ~10,000 |
| 5 | Timestamp conversion | ~500 |
| 6 | Signal binding | ~1 |
| — | Binary checks, range checks, misc | ~20,000 |
| **Total** | | **~5,080,000** |

**Implications:**
- Proving time (browser, WASM): ~30-60 seconds
- Proving time (mobile, React Native): ~60-120 seconds (needs benchmarking)
- Trusted setup: Requires ptau file with at least 2^23 constraints (~8M ceiling)
- Recommended ptau: `powersOfTau28_hez_final_23.ptau`

---

## 6. Public Signals Array Order

The verifier contract and off-chain verifier receive a flat array of public signals. The order must be consistent:

```
publicSignals[0]  = nullifier
publicSignals[1]  = timestamp
publicSignals[2]  = pubKeyHash
publicSignals[3]  = signalHash
publicSignals[4]  = nullifierSeed
publicSignals[5]  = ageAbove18        (0 if not revealed)
publicSignals[6]  = gender            (0 if not revealed)
publicSignals[7]  = state             (0 if not revealed)
publicSignals[8]  = pinCode           (0 if not revealed)
```

**Note:** The actual order is determined by Circom's signal declaration order. The above is the target order; we will declare signals in this sequence in the circuit template.

---

## 7. Data Format Reference

### Aadhaar Secure QR Code (V2) Byte Layout

```
[Compressed QR Payload]
  │
  └── zlib decompress
        │
        ├── Byte 0: Version (2 = V2 with photo)
        ├── Bytes 1-N: Delimiter-separated fields (0xFF separator)
        │   ├── Field 0: Reference ID (last 4 digits of Aadhaar + timestamp)
        │   ├── Field 1: Name
        │   ├── Field 2: Date of Birth (DD-MM-YYYY or YYYY)
        │   ├── Field 3: Gender (M/F/T)
        │   ├── Field 4: Care Of
        │   ├── Field 5: District
        │   ├── Field 6: Landmark
        │   ├── Field 7: House
        │   ├── Field 8: Location
        │   ├── Field 9: Pin Code (6 digits)
        │   ├── Field 10: Post Office
        │   ├── Field 11: State
        │   ├── Field 12: Street
        │   ├── Field 13: Sub District
        │   ├── Field 14: VTC (Village/Town/City)
        │   ├── Field 15: Mobile Hash (SHA-256, last 4 digits)
        │   └── Field 16: Email Hash (SHA-256)
        ├── Photo bytes: JPEG image (variable length)
        │   (Length indicated by a 2-byte prefix before photo data)
        └── Last 256 bytes: RSA-2048 Signature
```

### RSA Parameters

- **Key size:** 2048 bits
- **Public exponent (e):** 65537
- **Padding:** PKCS#1 v1.5 with SHA-256
- **Key source:** UIDAI public key (published at uidai.gov.in)
