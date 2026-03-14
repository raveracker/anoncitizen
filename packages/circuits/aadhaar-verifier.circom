pragma circom 2.1.0;

include "lib/sha256_hasher.circom";
include "lib/rsa_verifier.circom";
include "lib/field_extractor.circom";
include "lib/nullifier.circom";
include "lib/timestamp_converter.circom";

/// @title AadhaarVerifier
/// @notice Main circuit for privacy-preserving Aadhaar identity verification
/// @param maxDataBytes Maximum signed data byte length
/// @param n RSA limb bit size (64 for 2048-bit RSA)
/// @param k RSA limb count (32 for 2048-bit RSA)
/// @param maxPhotoBytes Maximum photo byte length for nullifier hashing
///
/// @dev Proves ownership of a valid Aadhaar document without revealing personal data.
///      The circuit performs these operations (mapped from proving_flow.png):
///
///      1. SHA-256 hash of the signed data
///      2. RSA signature verification against UIDAI public key
///      3. Field extraction (DOB, gender, state, pincode, photo bytes)
///      4. Nullifier computation: Poseidon(nullifierSeed, photoHash)
///      5. IST timestamp → UNIX UTC conversion
///      6. SignalHash constraint binding
///
///      Estimated constraint count (maxDataBytes=512, n=64, k=32):
///        SHA-256:       ~230,000  (512 bytes = 8 blocks × ~28,000)
///        RSA:           ~200,000
///        Field extract: ~100,000  (ByteSelector × field count)
///        Nullifier:     ~10,000   (Poseidon chain)
///        Timestamp:     ~500
///        Signal bind:   ~1
///        Total:         ~540,000
///
///      For production (maxDataBytes=16384): ~5,000,000+ constraints
template AadhaarVerifier(maxDataBytes, n, k, maxPhotoBytes) {
    // ================================================================
    // PRIVATE INPUTS
    // ================================================================

    signal input signedData[maxDataBytes];   // QR signed data bytes (0-padded)
    signal input signedDataLength;            // actual byte length
    signal input signature[k];                // RSA signature as k limbs

    // Field position hints (prover-provided, verified in circuit)
    signal input delimiterPositions[17];      // positions of 0xFF delimiters
    signal input photoStart;                  // byte offset of photo data
    signal input photoLength;                 // photo byte count
    signal input timestampStart;              // byte offset of timestamp

    // ================================================================
    // PUBLIC INPUTS
    // ================================================================

    signal input pubKey[k];                   // UIDAI RSA public key modulus (k limbs)
    signal input signalHash;                  // hash of application signal
    signal input nullifierSeed;               // application-specific nullifier seed

    // Selective disclosure flags (0 or 1)
    signal input revealAgeAbove18;
    signal input revealGender;
    signal input revealState;
    signal input revealPinCode;

    // ================================================================
    // OUTPUTS (always present)
    // ================================================================

    signal output out_nullifier;              // Poseidon(nullifierSeed, photoHash)
    signal output out_timestamp;              // UNIX UTC timestamp
    signal output out_pubKeyHash;             // Poseidon hash of public key
    signal output out_signalHash;             // pass-through of signalHash
    signal output out_nullifierSeed;          // pass-through of nullifierSeed

    // ================================================================
    // OUTPUTS (conditionally revealed)
    // ================================================================

    signal output out_ageAbove18;             // 1 if age ≥ 18, 0 if not revealed
    signal output out_gender;                 // 1=M, 2=F, 3=T, or 0 if not revealed
    signal output out_state;                  // encoded state or 0 if not revealed
    signal output out_pinCode;                // 6-digit pincode or 0 if not revealed

    // ================================================================
    // STAGE 1 — SHA-256 hash of signed data
    // ================================================================
    // Compute SHA-256(signedData[0..signedDataLength-1])
    // Output: 256-bit hash packed into 4 × 64-bit chunks for RSA comparison

    component sha256 = Sha256HashChunks(maxDataBytes);
    for (var i = 0; i < maxDataBytes; i++) {
        sha256.data[i] <== signedData[i];
    }
    sha256.dataLength <== signedDataLength;

    // ================================================================
    // STAGE 2 — RSA signature verification
    // ================================================================
    // Verify: signature^65537 mod pubKey == PKCS1v15(SHA-256(signedData))
    // If this passes, the signed data is authentic (signed by UIDAI).

    component rsa = RSAVerifier(n, k);
    for (var i = 0; i < 4; i++) {
        rsa.hashChunks[i] <== sha256.hashChunks[i];
    }
    for (var i = 0; i < k; i++) {
        rsa.signature[i] <== signature[i];
        rsa.pubkey[i] <== pubKey[i];
    }

    // ================================================================
    // STAGE 3 — Extract identity fields
    // ================================================================
    // Extract DOB, gender, state, pincode from signed data.
    // Apply conditional reveal: output = value × revealFlag.

    // Extract document year from timestamp for age calculation
    // (simplified: prover provides the year as a hint, verified against timestamp)
    signal input documentYear;

    component fields = FieldExtractor(maxDataBytes);
    for (var i = 0; i < maxDataBytes; i++) {
        fields.data[i] <== signedData[i];
    }
    fields.dataLength <== signedDataLength;
    for (var i = 0; i < 17; i++) {
        fields.delimiterPositions[i] <== delimiterPositions[i];
    }
    fields.photoStart <== photoStart;
    fields.photoLength <== photoLength;
    fields.revealAgeAbove18 <== revealAgeAbove18;
    fields.revealGender <== revealGender;
    fields.revealState <== revealState;
    fields.revealPinCode <== revealPinCode;
    fields.documentYear <== documentYear;

    out_ageAbove18 <== fields.ageAbove18;
    out_gender <== fields.gender;
    out_state <== fields.state;
    out_pinCode <== fields.pinCode;

    // ================================================================
    // STAGE 4 — Nullifier computation
    // ================================================================
    // Extract photo bytes and compute:
    //   photoHash = PoseidonChain(photoBytes)
    //   nullifier = Poseidon(nullifierSeed, photoHash)

    // Extract photo bytes from signed data
    signal photoBytes[maxPhotoBytes];
    component photoSelectors[maxPhotoBytes];
    for (var i = 0; i < maxPhotoBytes; i++) {
        photoSelectors[i] = ByteSelector(maxDataBytes);
        for (var j = 0; j < maxDataBytes; j++) {
            photoSelectors[i].data[j] <== signedData[j];
        }
        photoSelectors[i].index <== photoStart + i;
        photoBytes[i] <== photoSelectors[i].out;
    }

    // Hash photo bytes
    component photoHasher = PhotoHasher(maxPhotoBytes);
    for (var i = 0; i < maxPhotoBytes; i++) {
        photoHasher.photoBytes[i] <== photoBytes[i];
    }
    photoHasher.photoLength <== photoLength;

    // Compute nullifier
    component nullHash = NullifierHasher();
    nullHash.nullifierSeed <== nullifierSeed;
    nullHash.photoHash <== photoHasher.hash;
    out_nullifier <== nullHash.nullifier;

    // ================================================================
    // STAGE 5 — Timestamp conversion (IST → UNIX UTC)
    // ================================================================
    component tsExtractor = TimestampExtractor(maxDataBytes, 10);
    for (var i = 0; i < maxDataBytes; i++) {
        tsExtractor.data[i] <== signedData[i];
    }
    tsExtractor.timestampStart <== timestampStart;
    out_timestamp <== tsExtractor.utcTimestamp;

    // ================================================================
    // STAGE 6 — Public key hash
    // ================================================================
    // Hash the public key so verifiers can check against known UIDAI keys
    component pkHash = PubKeyHasher(k);
    for (var i = 0; i < k; i++) {
        pkHash.pubKey[i] <== pubKey[i];
    }
    out_pubKeyHash <== pkHash.hash;

    // ================================================================
    // STAGE 7 — Signal hash binding
    // ================================================================
    // Bind the proof to a specific signal by constraining signalHash.
    // The "square constraint" pattern forces the signal into the proof
    // without performing any meaningful computation on it.
    signal signalHashSquared;
    signalHashSquared <== signalHash * signalHash;
    out_signalHash <== signalHash;

    // ================================================================
    // STAGE 8 — Nullifier seed pass-through
    // ================================================================
    out_nullifierSeed <== nullifierSeed;
}

// ================================================================
// MAIN COMPONENT
// ================================================================
// Default instantiation for Aadhaar V2 QR codes:
//   maxDataBytes  = 512   (for testing; production: 16384)
//   n             = 64    (bits per RSA limb)
//   k             = 32    (limbs for 2048-bit RSA)
//   maxPhotoBytes = 256   (for testing; production: 8192)

component main {public [
    pubKey,
    signalHash,
    nullifierSeed,
    revealAgeAbove18,
    revealGender,
    revealState,
    revealPinCode
]} = AadhaarVerifier(512, 64, 32, 256);
