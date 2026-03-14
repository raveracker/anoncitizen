pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/// @title PackBytes
/// @notice Packs up to 31 bytes into a single field element (BN128 field < 254 bits)
/// @param nBytes Number of bytes to pack (must be ≤ 31)
/// @dev Bytes are packed big-endian: out = bytes[0]*256^(n-1) + bytes[1]*256^(n-2) + ... + bytes[n-1]
template PackBytes(nBytes) {
    signal input in[nBytes];
    signal output out;

    signal accum[nBytes + 1];
    accum[0] <== 0;
    for (var i = 0; i < nBytes; i++) {
        accum[i + 1] <== accum[i] * 256 + in[i];
    }
    out <== accum[nBytes];
}

/// @title PhotoHasher
/// @notice Hashes photo bytes into a single field element using iterative Poseidon
/// @param maxPhotoBytes Maximum number of photo bytes
/// @dev Packs photo bytes into chunks of 31 bytes each (to fit BN128 field),
///      then hashes all chunks using a Poseidon hash chain.
///      Chain: h0 = Poseidon(chunk[0], chunk[1])
///             h1 = Poseidon(h0, chunk[2])
///             ...
///      Constraint cost: ~300 per Poseidon invocation × (maxPhotoBytes/31) chunks
template PhotoHasher(maxPhotoBytes) {
    var chunksNeeded = (maxPhotoBytes + 30) \ 31; // ceil(maxPhotoBytes / 31)

    signal input photoBytes[maxPhotoBytes];
    signal input photoLength; // actual photo byte count
    signal output hash;

    // Pack bytes into field-element chunks (31 bytes each)
    signal chunks[chunksNeeded];
    component packers[chunksNeeded];

    for (var c = 0; c < chunksNeeded; c++) {
        var chunkSize = 31;
        // Last chunk may be smaller
        if ((c + 1) * 31 > maxPhotoBytes) {
            chunkSize = maxPhotoBytes - c * 31;
        }

        packers[c] = PackBytes(31);
        for (var b = 0; b < 31; b++) {
            var byteIdx = c * 31 + b;
            if (byteIdx < maxPhotoBytes) {
                packers[c].in[b] <== photoBytes[byteIdx];
            } else {
                packers[c].in[b] <== 0;
            }
        }
        chunks[c] <== packers[c].out;
    }

    // Iterative Poseidon hash chain over all chunks
    // We use Poseidon(2) at each step: state = Poseidon(state, nextChunk)
    signal states[chunksNeeded];

    if (chunksNeeded == 1) {
        component singleHash = Poseidon(1);
        singleHash.inputs[0] <== chunks[0];
        states[0] <== singleHash.out;
    } else {
        // First pair
        component firstHash = Poseidon(2);
        firstHash.inputs[0] <== chunks[0];
        firstHash.inputs[1] <== chunks[1];
        states[0] <== firstHash.out;
        states[1] <== firstHash.out;

        // Chain remaining chunks
        component chainHash[chunksNeeded - 2];
        for (var i = 2; i < chunksNeeded; i++) {
            chainHash[i - 2] = Poseidon(2);
            chainHash[i - 2].inputs[0] <== states[i - 1];
            chainHash[i - 2].inputs[1] <== chunks[i];
            states[i] <== chainHash[i - 2].out;
        }
    }

    hash <== states[chunksNeeded - 1];
}

/// @title NullifierHasher
/// @notice Computes nullifier = Poseidon(nullifierSeed, photoHash)
/// @dev The nullifier uniquely identifies a (user, application) pair.
///      Same user + same seed → same nullifier (prevents double-use).
///      Same user + different seed → different nullifier (preserves privacy across apps).
///      Constraint cost: ~300 (single Poseidon invocation)
template NullifierHasher() {
    signal input nullifierSeed;
    signal input photoHash;
    signal output nullifier;

    // Enforce non-zero seed (degenerate nullifier prevention)
    component seedNonZero = IsEqual();
    seedNonZero.in[0] <== nullifierSeed;
    seedNonZero.in[1] <== 0;
    seedNonZero.out === 0; // seed must NOT equal zero

    component hasher = Poseidon(2);
    hasher.inputs[0] <== nullifierSeed;
    hasher.inputs[1] <== photoHash;
    nullifier <== hasher.out;
}

/// @title PubKeyHasher
/// @notice Computes a hash of the RSA public key for output binding
/// @param k Number of limbs in the public key
/// @dev Hashes all k limbs using an iterative Poseidon chain.
///      This allows verifiers to check the proof was generated
///      against a known UIDAI public key.
template PubKeyHasher(k) {
    signal input pubKey[k];
    signal output hash;

    // Use iterative Poseidon chain (same pattern as PhotoHasher)
    signal states[k];

    component firstHash = Poseidon(2);
    firstHash.inputs[0] <== pubKey[0];
    firstHash.inputs[1] <== pubKey[1];
    states[0] <== firstHash.out;
    states[1] <== firstHash.out;

    component chainHash[k - 2];
    for (var i = 2; i < k; i++) {
        chainHash[i - 2] = Poseidon(2);
        chainHash[i - 2].inputs[0] <== states[i - 1];
        chainHash[i - 2].inputs[1] <== pubKey[i];
        states[i] <== chainHash[i - 2].out;
    }

    hash <== states[k - 1];
}
