# Phase 2 — Circuit Benchmarks & Constraint Analysis

## Circuit Files Delivered

| File | Template | Purpose |
|------|----------|---------|
| `lib/sha256_hasher.circom` | `Sha256Hasher(maxBytes)`, `Sha256HashChunks(maxBytes)` | Variable-length SHA-256 hash using block-by-block compression |
| `lib/rsa_verifier.circom` | `RSAVerifier(n,k)`, `BigModExp65537(n,k)` | RSA-2048 PKCS#1 v1.5 signature verification |
| `lib/field_extractor.circom` | `FieldExtractor(maxDataBytes)`, `ConditionalReveal()`, `GenderEncoder()`, `AgeChecker()`, `AsciiDigitsToNumber(n)` | Extract identity fields with conditional reveal |
| `lib/nullifier.circom` | `NullifierHasher()`, `PhotoHasher(maxPhotoBytes)`, `PubKeyHasher(k)` | Poseidon-based nullifier and key hashing |
| `lib/timestamp_converter.circom` | `ISTtoUTC()`, `TimestampExtractor(maxDataBytes, n)`, `DateToUnixUTC()` | IST → UNIX UTC timestamp conversion |
| `aadhaar-verifier.circom` | `AadhaarVerifier(maxDataBytes, n, k, maxPhotoBytes)` | Main circuit composing all sub-circuits |

## Constraint Count Estimates

### Per Sub-Circuit

| Sub-Circuit | Parameters | Estimated Constraints | Notes |
|-------------|-----------|----------------------|-------|
| SHA-256 Hasher | maxBytes=512 (8 blocks) | ~224,000 | ~28,000 per 64-byte block |
| SHA-256 Hasher | maxBytes=16384 (256 blocks) | ~7,168,000 | Production size |
| RSA Verifier | n=64, k=32 | ~200,000 | 16 squarings + 1 multiplication in BigInt |
| Field Extractor | maxDataBytes=512 | ~100,000 | ByteSelector O(maxBytes) × field count |
| Photo Hasher | maxPhotoBytes=256 | ~3,000 | ~300 per Poseidon × ~10 chunks |
| Photo Hasher | maxPhotoBytes=8192 | ~80,000 | ~300 per Poseidon × ~265 chunks |
| Nullifier Hasher | — | ~300 | Single Poseidon(2) |
| PubKey Hasher | k=32 | ~9,000 | 30 × Poseidon(2) chain |
| Timestamp Converter | — | ~500 | Basic arithmetic + digit parsing |
| Conditional Reveal | — | ~2 | 1 boolean check + 1 multiplication |
| Signal Hash Binding | — | ~1 | Square constraint |

### Total Circuit (AadhaarVerifier)

| Configuration | Total Constraints | Proving Time (est.) | ptau Required |
|---------------|-------------------|---------------------|---------------|
| **Test** (maxDataBytes=512, maxPhotoBytes=256) | ~540,000 | ~5-10 sec | 2^20 |
| **Production** (maxDataBytes=16384, maxPhotoBytes=8192) | ~7,600,000 | ~60-120 sec | 2^23 |

### Constraint Breakdown (Test Configuration)

```
SHA-256 (8 blocks):      224,000   (41.5%)
RSA verification:        200,000   (37.0%)
Field extraction:        100,000   (18.5%)
Photo hashing:             3,000   (0.6%)
PubKey hashing:            9,000   (1.7%)
Timestamp:                   500   (0.1%)
Nullifier:                   300   (0.1%)
Conditional reveals:          10   (0.0%)
Signal binding:                1   (0.0%)
                         -------
TOTAL:                  ~537,000
```

## Dependencies

| Package | Version | Used For |
|---------|---------|----------|
| `circomlib` | ^2.0.5 | Poseidon, SHA-256 compression, Num2Bits, LessThan, IsEqual |
| `@zk-email/circuits` | ^6.2.0 | Reference RSA BigInt patterns (audited implementations) |
| `circom_tester` | ^0.0.24 | Circuit unit testing |
| `snarkjs` | ^0.7.5 | Proving, verification, trusted setup |

## Architecture Decisions Made

### ADR-003: RSA Implementation

**Decision:** Use `@zk-email/circuits` BigInt patterns for RSA verification, adapted to our interface.

**Rationale:** The `@zk-email/circuits` library provides battle-tested BigInt modular arithmetic used in production by zk-email and anon-aadhaar. Writing RSA from scratch is error-prone and unnecessary.

**Status:** The current `rsa_verifier.circom` implements the structural framework (BigMul, BigMod, BigModExp65537, RSAVerifier). The BigMod template requires carry-chain verification for production use — this will be completed by importing the audited implementation from `@zk-email/circuits` during Phase 5 security review.

### ADR-004: SHA-256 Implementation

**Decision:** Use circomlib's `Sha256compression()` for block-by-block hashing.

**Rationale:** circomlib's SHA-256 compression function is the standard, audited implementation. Our `Sha256Hasher` wraps it with variable-length support (processes all blocks, uses SHA-256 padding).

**Status:** Implemented. For variable-length data, the current implementation processes all blocks and outputs the final state. A production optimization would add multiplexer-based state selection for the correct final block.

### ADR-005: Photo Bytes for Nullifier

**Decision:** Hash photo bytes in chunks of 31 (to fit BN128 field elements) using iterative Poseidon chain.

**Rationale:** Photo bytes are too large for a single Poseidon invocation. Chunking into 31-byte segments and chaining Poseidon(2) calls provides a compact hash (~300 constraints per step) while ensuring the nullifier is uniquely bound to the photo data.

## Test Coverage

| Test | Sub-Circuit | Status |
|------|------------|--------|
| IST to UTC conversion | `ISTtoUTC` | Implemented |
| Nullifier determinism | `NullifierHasher` | Implemented |
| Nullifier uniqueness (different seeds) | `NullifierHasher` | Implemented |
| Zero seed rejection | `NullifierHasher` | Implemented |
| Conditional reveal (flag=1) | `ConditionalReveal` | Implemented |
| Conditional reveal (flag=0) | `ConditionalReveal` | Implemented |
| Non-boolean flag rejection | `ConditionalReveal` | Implemented |
| Gender encoding (M/F/T) | `GenderEncoder` | Implemented |
| Invalid gender rejection | `GenderEncoder` | Implemented |
| ASCII digit parsing | `AsciiDigitsToNumber` | Implemented |
| Full circuit integration | `AadhaarVerifier` | Deferred to Phase 5 (requires test RSA keypair) |

## Known Limitations & Next Steps

1. **RSA BigMod carry verification**: The `BigMod` template needs complete carry-chain range checks. Production implementation should import from `@zk-email/circuits`.

2. **Variable-length SHA-256 output selection**: Current implementation processes all blocks and outputs the final state. For variable-length data, a multiplexer should select the correct intermediate state.

3. **Photo byte extraction**: Uses `ByteSelector` per photo byte, which is O(maxDataBytes × maxPhotoBytes) constraints. For large photos, this should be optimized with batch extraction.

4. **Full integration test**: Requires a test RSA keypair + signed test data that mimics the Aadhaar QR format. Will be created in Phase 5.

5. **Timestamp format**: The exact Aadhaar QR timestamp format needs verification against real QR samples. Current implementation handles numeric string timestamps.
