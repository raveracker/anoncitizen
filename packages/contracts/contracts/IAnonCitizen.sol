// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IAnonCitizen
/// @notice Interface for the AnonCitizen proof verification contract
interface IAnonCitizen {
    /// @notice Emitted when a proof is successfully verified and recorded
    /// @param nullifier Unique identifier derived from identity + scope
    /// @param timestamp UNIX UTC timestamp from the Aadhaar document
    /// @param pubKeyHash Hash of the UIDAI public key used in the proof
    /// @param signalHash Hash of the signal bound to the proof
    event ProofVerified(
        uint256 indexed nullifier,
        uint256 timestamp,
        uint256 pubKeyHash,
        uint256 signalHash
    );

    /// @notice Verifies a proof and records the nullifier to prevent replay
    /// @param _pA Proof point A (G1)
    /// @param _pB Proof point B (G2)
    /// @param _pC Proof point C (G1)
    /// @param _pubSignals Public signals array [nullifier, timestamp, pubKeyHash,
    ///        signalHash, nullifierSeed, ageAbove18, gender, state, pincode]
    function verifyAndRecord(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[9] calldata _pubSignals
    ) external;

    /// @notice Checks if a nullifier has already been used
    /// @param nullifier The nullifier to check
    /// @return True if the nullifier has been used
    function isNullifierUsed(
        uint256 nullifier
    ) external view returns (bool);
}
