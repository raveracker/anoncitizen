# @anoncitizen/contracts

Solidity smart contracts for on-chain AnonCitizen ZK proof verification.

## Installation

```bash
npm install @anoncitizen/contracts
```

## Contracts

### `AnonCitizen.sol`

Wrapper contract providing:
- Groth16 proof verification via `verifyAndRecord()`
- Nullifier tracking to prevent replay attacks
- Trusted public key hash registry for UIDAI key rotation
- `ProofVerified` event emission for indexing

### `Groth16Verifier.sol`

Auto-generated Groth16 pairing verifier (from snarkjs). Uses BN254 elliptic curve precompiles.

### `IAnonCitizen.sol`

Interface for the AnonCitizen contract.

## Usage

### Deploy

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

### Integrate

```solidity
IAnonCitizen anoncitizen = IAnonCitizen(deployedAddress);

// Verify and record a proof (reverts on failure)
anoncitizen.verifyAndRecord(pA, pB, pC, pubSignals);

// Check if a nullifier was already used
bool used = anoncitizen.isNullifierUsed(nullifier);
```

### Public Signals

```
[0] nullifier      — unique per (identity, nullifierSeed)
[1] timestamp      — UNIX UTC from Aadhaar document
[2] pubKeyHash     — hash of UIDAI RSA public key
[3] signalHash     — hash of bound signal (anti-frontrun)
[4] nullifierSeed  — application-provided scope seed
[5] ageAbove18     — 1 if age >= 18, 0 if not revealed
[6] gender         — 1=M, 2=F, 3=T, 0 if not revealed
[7] state          — encoded state, 0 if not revealed
[8] pincode        — 6-digit PIN, 0 if not revealed
```

## Development

```bash
npx hardhat compile
npx hardhat test
REPORT_GAS=true npx hardhat test  # with gas benchmarks
```

## License

MIT
