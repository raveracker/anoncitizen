# ADR-001: zkey Distribution via CDN/IPFS

## Status
Accepted

## Context
The Groth16 zkey file for the aadhaar-verifier circuit is estimated at 50-200 MB depending on constraint count. This is far too large to bundle in an npm package (npm has a ~1GB limit but packages over 10MB are discouraged).

## Decision
The zkey will be hosted on IPFS (pinned via Pinata or similar service) with a public CDN gateway. The `@anoncitizen/core` package will:

1. Bundle only the lightweight artifacts (.wasm ~2-5MB, verification_key.json ~2KB)
2. Provide a `fetchZKey(url?: string)` utility that downloads and caches the zkey
3. Ship with a default IPFS URL pointing to the official zkey
4. Verify zkey integrity via SHA-256 content hash (hardcoded in the SDK)
5. Cache the zkey in IndexedDB (web) or filesystem (React Native) after first download

## Alternatives Considered
- **Bundle in npm**: Rejected — too large, bloats installs for all consumers
- **Separate npm package**: Rejected — npm is not designed for large binary artifacts
- **GitHub Releases**: Possible fallback but IPFS provides better decentralization and content addressing

## Consequences
- First-time users must download the zkey before generating proofs (adds latency)
- Developers can self-host the zkey and pass their own URL
- Key rotation requires publishing new IPFS hash + SDK update
- Offline use requires pre-caching the zkey
