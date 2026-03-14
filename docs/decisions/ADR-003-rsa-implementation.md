# ADR-003: RSA Implementation Using @zk-email/circuits Patterns

## Status
Accepted

## Context
RSA-2048 signature verification is the most complex sub-circuit in the AadhaarVerifier (~200,000 constraints). It requires BigInt modular exponentiation: `signature^65537 mod pubkey`. Writing this from scratch is error-prone and security-critical.

## Decision
Use `@zk-email/circuits` BigInt arithmetic patterns as the foundation for RSA verification. Our `rsa_verifier.circom` implements the structural framework (BigMul, BigMod, BigModExp65537, RSAVerifier) following the same approach used by zk-email and anon-aadhaar.

The `BigMod` template requires carry-chain verification for production soundness. During Phase 5 (security review), the implementation will be verified against the audited `@zk-email/circuits` library.

## Rationale
- `@zk-email/circuits` is battle-tested in production (zk-email, anon-aadhaar)
- Same RSA-2048 verification with PKCS#1 v1.5 padding
- Same BigInt limb representation (32 × 64-bit)
- Audited by multiple security firms

## Consequences
- Runtime dependency on `@zk-email/circuits` npm package
- Must pin version and track security advisories
- BigMod carry verification must be completed before production use
