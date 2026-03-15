// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IAnonCitizen.sol";

/// @title IAnonCitizenVerifier
/// @notice Interface for the auto-generated Groth16 verifier contract
interface IAnonCitizenVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[32] calldata _pubSignals
    ) external view returns (bool);
}

/// @title AnonCitizen
/// @notice Verifies Aadhaar ZK proofs on-chain with nullifier tracking
/// @dev Wraps the snarkjs-generated Groth16 verifier with replay prevention
///      and event emission. The verifier address is immutable (set once at deploy).
///
///      Public signal indices (must match circuit output order):
///        [0] nullifier     — unique per (identity, nullifierSeed) pair
///        [1] timestamp     — UNIX UTC from Aadhaar document
///        [2] pubKeyHash   — hash of the UIDAI RSA public key used
///        [3] signalHash   — hash of the bound signal (anti-frontrun)
///        [4] nullifierSeed — the application-provided scope seed
///        [5] ageAbove18   — 1 if age ≥ 18, 0 if not revealed
///        [6] gender       — 1=M, 2=F, 3=T, 0 if not revealed
///        [7] state        — encoded state value, 0 if not revealed
///        [8] pincode      — 6-digit PIN, 0 if not revealed
///
///      Gas cost: ~260,000 for verifyAndRecord (Groth16 pairing ~230k + storage ~30k)
contract AnonCitizen is IAnonCitizen {
    /// @notice The Groth16 verifier contract (immutable, set at deployment)
    IAnonCitizenVerifier public immutable verifier;

    /// @notice Contract owner (can manage trusted public key hashes)
    address public immutable owner;

    /// @notice Tracks which nullifiers have been used (prevents replay)
    mapping(uint256 => bool) public nullifierUsed;

    /// @notice Tracks trusted UIDAI public key hashes
    mapping(uint256 => bool) public trustedPubKeyHash;

    /// @notice The BN128 scalar field modulus (SNARK_SCALAR_FIELD)
    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    error NullifierAlreadyUsed();
    error InvalidProof();
    error InvalidNullifier();
    error InvalidSignalHash();
    error UntrustedPublicKey();
    error Unauthorized();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @param _verifier Address of the deployed Groth16Verifier contract
    constructor(address _verifier) {
        verifier = IAnonCitizenVerifier(_verifier);
        owner = msg.sender;
    }

    /// @notice Register a trusted UIDAI public key hash
    /// @param _pubKeyHash Poseidon hash of the RSA public key limbs
    function addTrustedPubKeyHash(uint256 _pubKeyHash) external onlyOwner {
        trustedPubKeyHash[_pubKeyHash] = true;
    }

    /// @notice Remove a trusted UIDAI public key hash (key rotation)
    /// @param _pubKeyHash Poseidon hash of the RSA public key limbs
    function removeTrustedPubKeyHash(uint256 _pubKeyHash) external onlyOwner {
        trustedPubKeyHash[_pubKeyHash] = false;
    }

    /// @inheritdoc IAnonCitizen
    function verifyAndRecord(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[32] calldata _pubSignals
    ) external {
        uint256 nullifier = _pubSignals[0];

        // Validate nullifier is non-zero and in field
        if (nullifier == 0 || nullifier >= SNARK_SCALAR_FIELD)
            revert InvalidNullifier();

        // Check nullifier hasn't been used (early exit saves gas on replays)
        if (nullifierUsed[nullifier]) revert NullifierAlreadyUsed();

        // Validate public key hash is from a trusted UIDAI key
        if (!trustedPubKeyHash[_pubSignals[2]]) revert UntrustedPublicKey();

        // Verify the Groth16 proof
        bool valid = verifier.verifyProof(_pA, _pB, _pC, _pubSignals);
        if (!valid) revert InvalidProof();

        // Record nullifier to prevent replay
        nullifierUsed[nullifier] = true;

        // Emit event with key public signals
        emit ProofVerified(
            nullifier,
            _pubSignals[1], // timestamp
            _pubSignals[2], // pubKeyHash
            _pubSignals[3]  // signalHash
        );
    }

    /// @inheritdoc IAnonCitizen
    function isNullifierUsed(
        uint256 nullifier
    ) external view returns (bool) {
        return nullifierUsed[nullifier];
    }

    /// @notice Verifies a proof without recording the nullifier (view-only)
    /// @dev Useful for off-chain simulation or dry-run checks
    function verifyOnly(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[32] calldata _pubSignals
    ) external view returns (bool) {
        return verifier.verifyProof(_pA, _pB, _pC, _pubSignals);
    }
}
