# ADR-002: Poseidon for Nullifier Hash Function

## Status
Accepted

## Context
The nullifier is computed as `hash(nullifierSeed, photoHash)` inside the circuit. The hash function choice directly impacts constraint count and proving time.

## Decision
Use Poseidon hash for all in-circuit hashing (nullifier computation and photo byte hashing). SHA-256 is used only for the document integrity check (Stage 1) because the RSA signature was computed over a SHA-256 hash.

## Rationale
- Poseidon: ~300 constraints per hash invocation
- SHA-256: ~30,000 constraints per hash invocation (100x more expensive)
- The nullifier is protocol-internal — it doesn't need to match any external standard
- Poseidon is the standard choice for ZK-circuit hashing (used by Semaphore, Tornado Cash, etc.)

## Consequences
- Nullifiers cannot be verified using standard SHA-256 tooling outside the circuit
- Off-chain verification uses the same Poseidon implementation (circomlibjs) for consistency
- If Poseidon is ever found to be insecure, the circuit must be redeployed with a new hash function
