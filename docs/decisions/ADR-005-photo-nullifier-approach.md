# ADR-005: Photo Bytes Hashed via Poseidon Chain for Nullifier

## Status
Accepted

## Context
The nullifier must be derived from the photo bytes embedded in the Aadhaar QR (which are unique per person). Photo data is 2-8KB, too large for a single Poseidon invocation (max ~16 inputs).

## Decision
Pack photo bytes into field elements (31 bytes per element, to fit BN128 field), then hash all chunks using an iterative Poseidon chain:
```
h0 = Poseidon(chunk[0], chunk[1])
h1 = Poseidon(h0, chunk[2])
...
photoHash = hN
nullifier = Poseidon(nullifierSeed, photoHash)
```

## Rationale
- Poseidon: ~300 constraints per invocation (vs ~28,000 for SHA-256)
- For 8KB photo: ~265 chunks × 300 = ~80,000 constraints (vs ~3.5M with SHA-256)
- The photo hash doesn't need to match any external standard — it's protocol-internal
- Same approach used by Semaphore and other ZK identity protocols

## Consequences
- Photo hash is not verifiable with standard tools outside the circuit
- The Poseidon hash chain order is fixed (changing it produces different nullifiers)
- Photo byte packing must be deterministic (31 bytes per field element, big-endian)
- Off-chain verification (in `@anoncitizen/core`) must use the same Poseidon implementation (circomlibjs)
