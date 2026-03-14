# Phase 3 — API Design Review

## @anoncitizen/core Public API Surface

### Entry Points

| Export | Type | Description |
|--------|------|-------------|
| `AnonCitizen` | Class | Main SDK entry point — `parseQR()`, `prove()`, `verify()`, `formatForContract()` |
| `parseQRCode()` | Function | Standalone QR parser (for advanced usage) |
| `preVerifySignature()` | Function | RSA pre-check outside the circuit |
| `generateProof()` | Function | Low-level snarkjs proof generation |
| `verifyProofOffChain()` | Function | Low-level snarkjs verification |
| `formatProofForContract()` | Function | Convert proof to Solidity calldata |
| `hashSignal()` | Function | Hash a signal string for circuit input |
| `hashSignalPoseidon()` | Function | Hash with Poseidon (async, matches circuit) |
| `generateNullifierSeed()` | Function | Deterministic seed from app ID |
| `parseRSAPublicKey()` | Function | Parse raw modulus bytes |
| `parseRSAPublicKeyFromCert()` | Function | Parse from X.509 certificate |
| `decodePublicSignals()` | Function | Decode signal array to typed result |

### Type Exports

| Type | Purpose |
|------|---------|
| `AnonCitizenConfig` | SDK configuration |
| `ProofRequest` | Proof generation input options |
| `AnonCitizenProof` | Proof + public signals output |
| `VerificationResult` | Decoded verification output |
| `AadhaarQRPayload` | Parsed QR data structure |
| `ContractCalldata` | Solidity-formatted proof |
| `RSAPublicKey` | Public key with circuit limbs |
| `CircuitInputs` | Raw circuit input signals |
| `Gender` | Enum: NotRevealed, Male, Female, Transgender |
| `PUBLIC_SIGNAL_INDEX` | Maps signal names → array indices |

---

## API Ergonomics Assessment

### Strengths

1. **Two-tier API**: `AnonCitizen` class for simple usage, individual functions for power users.
2. **Sensible defaults**: `signal` defaults to "1", reveal flags default to false.
3. **Type safety**: Full TypeScript types for all inputs/outputs. No `any` types.
4. **Error messages**: Clear, actionable messages (e.g., "Public key not set. Call setPublicKey() first.").
5. **B-point reversal handled internally**: `formatProofForContract()` handles the BN254 coordinate swap so developers don't need to know about it.

### Findings & Recommendations

| # | Severity | Finding | Recommendation |
|---|----------|---------|----------------|
| 1 | Medium | `hashSignal()` uses a simple BigInt conversion, not Poseidon. The circuit uses Poseidon. | Rename to `hashSignalSimple()` and make `hashSignalPoseidon()` the default `hashSignal()`. Or document the discrepancy clearly. |
| 2 | Low | `AnonCitizen.prove()` re-parses QR data on every call even if previously parsed. | Add an overload that accepts a pre-parsed `AadhaarQRPayload` to avoid redundant work. |
| 3 | Low | `generateNullifierSeed()` uses a simple string-to-BigInt conversion. | Consider using Poseidon hash of the app ID for better distribution. Document the approach. |
| 4 | Info | `verificationKeyUrl` fetch doesn't cache across calls. | The class caches after first fetch (correct). Document this behavior. |
| 5 | Info | `parseRSAPublicKeyFromCert()` has a simplified ASN.1 parser. | Sufficient for UIDAI certificates. Add a note about limitations for unusual cert formats. |
| 6 | Info | No progress callback for proof generation. | Add optional `onProgress` callback in Phase 4 when building the React hooks. |

### Naming Consistency

| Pattern | Consistent? | Notes |
|---------|-------------|-------|
| `camelCase` for functions | Yes | All functions use camelCase |
| `PascalCase` for types/classes | Yes | All types and the AnonCitizen class |
| `UPPER_CASE` for constants | Yes | `SNARK_SCALAR_FIELD`, `PUBLIC_SIGNAL_INDEX` |
| Verb-first for functions | Yes | `parse`, `generate`, `verify`, `format`, `hash` |

---

## @anoncitizen/contracts Public Interface

### Contract: AnonCitizen.sol

| Function | Visibility | Gas | Description |
|----------|------------|-----|-------------|
| `verifyAndRecord()` | external | ~260k | Verify proof + record nullifier + emit event |
| `verifyOnly()` | view | ~230k | Verify without recording (for dry-run) |
| `isNullifierUsed()` | view | ~2.6k | Check if nullifier was already used |
| `verifier()` | view | ~100 | Get the Groth16 verifier address |

### Events

| Event | Indexed | Fields |
|-------|---------|--------|
| `ProofVerified` | `nullifier` | timestamp, pubKeyHash, signalHash |

### Custom Errors (gas-efficient)

| Error | When |
|-------|------|
| `NullifierAlreadyUsed()` | Replay attempt |
| `InvalidProof()` | Groth16 verification failed |
| `InvalidNullifier()` | Zero or out-of-field nullifier |

### Security Assessment

- Nullifier checked BEFORE proof verification (saves gas on replays)
- Verifier address is `immutable` (saves SLOAD, no upgrade attack)
- Custom errors instead of require strings (gas efficient)
- No reentrancy risk (no external calls after state change)
- No owner/admin functions (fully permissionless)

### Gas Benchmarks (Estimated)

| Operation | Gas |
|-----------|-----|
| Deploy Groth16Verifier | ~1,500,000 |
| Deploy AnonCitizen | ~400,000 |
| `verifyAndRecord` (first call) | ~260,000 |
| `verifyAndRecord` (nullifier replay revert) | ~5,000 |
| `isNullifierUsed` | ~2,600 |

---

## Cross-Package Consistency

| Aspect | core → contracts | Status |
|--------|-----------------|--------|
| Public signal order | [0-8] matches in both | Aligned |
| Signal hash format | Poseidon in circuit, passed through in SDK | Aligned |
| B-point reversal | Handled in `formatProofForContract()` | Correct |
| Nullifier validation | Core: non-zero seed. Contract: non-zero nullifier + field range | Aligned |
| SNARK_SCALAR_FIELD | Same constant in both | Aligned |
