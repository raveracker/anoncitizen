# ADR-004: SHA-256 Using circomlib Sha256compression

## Status
Accepted

## Context
The circuit must compute SHA-256(signedData) to verify the RSA signature. The signed data is variable-length (2-10KB), meaning the circuit can't use a fixed-size SHA-256 template.

## Decision
Use circomlib's `Sha256compression()` for block-by-block processing. Our `Sha256Hasher` template:
1. Converts input bytes to bits
2. Applies SHA-256 padding logic in-circuit
3. Processes each 512-bit block through `Sha256compression()`
4. Outputs the final compression state as the hash

For variable-length support, the circuit processes all `maxBlocks` blocks. A production optimization will add multiplexer-based state selection to output the correct intermediate state for the actual data length.

## Rationale
- circomlib `Sha256compression` is the standard, audited SHA-256 primitive in circom
- Block-by-block processing allows variable-length input
- ~28,000 constraints per block is the known floor for SHA-256 in circom

## Consequences
- SHA-256 dominates constraint count (~41% for test config, ~94% for production)
- For production (16KB input), ~256 blocks × 28,000 = ~7.2M constraints
- Proving time is primarily determined by signed data length
- A production optimization could pre-compute SHA-256 outside the circuit and verify only the hash (reduces to ~1 block), but this changes the security model
