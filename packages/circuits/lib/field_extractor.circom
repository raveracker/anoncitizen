pragma circom 2.1.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/gates.circom";

/// @title ByteSelector
/// @notice Selects a single byte from a data array at a given index
/// @param maxBytes Length of the data array
/// @dev Uses O(maxBytes) equality comparisons. For repeated use,
///      consider batched selection to amortize overhead.
template ByteSelector(maxBytes) {
    signal input data[maxBytes];
    signal input index;
    signal output out;

    component eq[maxBytes];
    signal matches[maxBytes];

    for (var i = 0; i < maxBytes; i++) {
        eq[i] = IsEqual();
        eq[i].in[0] <== index;
        eq[i].in[1] <== i;
        matches[i] <== data[i] * eq[i].out;
    }

    // Sum all matches (exactly one eq[i].out == 1)
    signal partialSum[maxBytes + 1];
    partialSum[0] <== 0;
    for (var i = 0; i < maxBytes; i++) {
        partialSum[i + 1] <== partialSum[i] + matches[i];
    }
    out <== partialSum[maxBytes];
}

/// @title ExtractBytes
/// @notice Extracts a contiguous range of bytes from data[start..start+len-1]
/// @param maxBytes Length of the data array
/// @param maxExtractLen Maximum extraction length
template ExtractBytes(maxBytes, maxExtractLen) {
    signal input data[maxBytes];
    signal input start;
    signal input len; // actual length to extract (≤ maxExtractLen)
    signal output out[maxExtractLen];

    component selectors[maxExtractLen];
    component isActive[maxExtractLen];

    for (var i = 0; i < maxExtractLen; i++) {
        // Select byte at position (start + i)
        selectors[i] = ByteSelector(maxBytes);
        for (var j = 0; j < maxBytes; j++) {
            selectors[i].data[j] <== data[j];
        }
        selectors[i].index <== start + i;

        // Zero out bytes beyond actual length
        isActive[i] = LessThan(32);
        isActive[i].in[0] <== i;
        isActive[i].in[1] <== len;

        out[i] <== selectors[i].out * isActive[i].out;
    }
}

/// @title DelimiterVerifier
/// @notice Verifies that a delimiter byte (0xFF) exists at the specified position
/// @param maxBytes Length of the data array
template DelimiterVerifier(maxBytes) {
    signal input data[maxBytes];
    signal input position;

    component selector = ByteSelector(maxBytes);
    for (var i = 0; i < maxBytes; i++) {
        selector.data[i] <== data[i];
    }
    selector.index <== position;

    // Verify the byte at position is the delimiter (0xFF = 255)
    selector.out === 255;
}

/// @title AsciiDigitsToNumber
/// @notice Converts an array of ASCII digit bytes to a number
/// @param nDigits Number of digits
/// @dev Each byte must be in range 0x30-0x39 (ASCII '0'-'9')
///      Constraint cost: O(nDigits) for range checks + arithmetic
template AsciiDigitsToNumber(nDigits) {
    signal input digits[nDigits];
    signal output value;

    // Verify each byte is a valid ASCII digit and convert
    signal digitValues[nDigits];
    component rangeCheck[nDigits];

    for (var i = 0; i < nDigits; i++) {
        // Subtract ASCII '0' (0x30 = 48) to get numeric value
        digitValues[i] <== digits[i] - 48;

        // Verify digit is in range 0-9
        rangeCheck[i] = LessThan(8);
        rangeCheck[i].in[0] <== digitValues[i];
        rangeCheck[i].in[1] <== 10;
        rangeCheck[i].out === 1;
    }

    // Compute the number: d[0]*10^(n-1) + d[1]*10^(n-2) + ... + d[n-1]
    signal partial[nDigits + 1];
    partial[0] <== 0;
    for (var i = 0; i < nDigits; i++) {
        partial[i + 1] <== partial[i] * 10 + digitValues[i];
    }
    value <== partial[nDigits];
}

/// @title AgeChecker
/// @notice Checks if a person is above 18 based on DOB year and document timestamp year
/// @dev Simplified check: (docYear - birthYear) >= 18
///      A more precise check would also consider month and day.
template AgeChecker() {
    signal input birthYear;     // 4-digit year from DOB
    signal input documentYear;  // 4-digit year from document timestamp
    signal output isAbove18;    // 1 if age >= 18, 0 otherwise

    // age = documentYear - birthYear
    signal age;
    age <== documentYear - birthYear;

    // Check: age >= 18, i.e., age - 18 >= 0, i.e., 18 <= age
    component gte = LessThan(16);
    gte.in[0] <== 17; // 17 < age means age >= 18
    gte.in[1] <== age;
    isAbove18 <== gte.out;
}

/// @title GenderEncoder
/// @notice Encodes the gender ASCII byte as a numeric value
/// @dev M(0x4D)=1, F(0x46)=2, T(0x54)=3 (Transgender)
template GenderEncoder() {
    signal input genderByte; // ASCII byte: 'M'=77, 'F'=70, 'T'=84
    signal output genderCode; // 1=Male, 2=Female, 3=Transgender

    component isM = IsEqual();
    isM.in[0] <== genderByte;
    isM.in[1] <== 77; // 'M'

    component isF = IsEqual();
    isF.in[0] <== genderByte;
    isF.in[1] <== 70; // 'F'

    component isT = IsEqual();
    isT.in[0] <== genderByte;
    isT.in[1] <== 84; // 'T'

    // Ensure exactly one matches
    signal sumMatches;
    sumMatches <== isM.out + isF.out + isT.out;
    sumMatches === 1;

    // Encode: M=1, F=2, T=3
    genderCode <== isM.out * 1 + isF.out * 2 + isT.out * 3;
}

/// @title ConditionalReveal
/// @notice Outputs the value only when the reveal flag is 1, otherwise 0
template ConditionalReveal() {
    signal input value;
    signal input revealFlag;
    signal output out;

    // Enforce revealFlag is boolean (0 or 1)
    revealFlag * (1 - revealFlag) === 0;

    // Output value if flag is set, else 0
    out <== value * revealFlag;
}

/// @title FieldExtractor
/// @notice Extracts and conditionally reveals identity fields from Aadhaar signed data
/// @param maxDataBytes Maximum signed data byte length
/// @dev The prover provides field positions as private inputs (hints).
///      The circuit verifies delimiter bytes at those positions.
///      Fields extracted: DOB (for age check), gender, state, pincode, photo.
///
///      Aadhaar QR field order (0xFF delimited, per aadhaar_qr_spec.md):
///      [0] version, [1] emailMobileIndicator, [2] referenceId, [3] name,
///      [4] dob, [5] gender, [6] careOf, [7] district, [8] landmark,
///      [9] house, [10] location, [11] pinCode, [12] postOffice,
///      [13] state, [14] street, [15] subDistrict, [16] vtc
///
///      After 17 delimited fields: email/mobile hash bytes (0/32/64),
///      then photo bytes (JPEG 2000), then RSA signature (last 256 bytes).
///
///      Constraint cost: O(maxDataBytes) per field extraction
template FieldExtractor(maxDataBytes) {
    signal input data[maxDataBytes];
    signal input dataLength;

    // ----- Field position hints (private inputs, provided by prover) -----
    signal input delimiterPositions[17]; // positions of 0xFF delimiters after each field
    signal input photoStart;             // byte offset where photo data begins
    signal input photoLength;            // length of photo data in bytes

    // ----- Reveal flags (public inputs) -----
    signal input revealAgeAbove18;
    signal input revealGender;
    signal input revealState;
    signal input revealPinCode;

    // ----- Document year for age calculation -----
    signal input documentYear; // from timestamp extraction

    // ----- Outputs -----
    signal output ageAbove18;  // 1 if age >= 18, 0 if not revealed or under 18
    signal output gender;      // encoded gender (1=M, 2=F, 3=T) or 0 if not revealed
    signal output state;       // numeric state hash or 0 if not revealed
    signal output pinCode;     // 6-digit pincode or 0 if not revealed
    signal output photoHash;   // Poseidon hash of photo bytes (always computed for nullifier)

    // ================================================================
    // STEP 1 — Verify delimiter positions
    // ================================================================
    component delimCheck[17];
    for (var i = 0; i < 17; i++) {
        delimCheck[i] = DelimiterVerifier(maxDataBytes);
        for (var j = 0; j < maxDataBytes; j++) {
            delimCheck[i].data[j] <== data[j];
        }
        delimCheck[i].position <== delimiterPositions[i];
    }

    // ================================================================
    // STEP 2 — Extract DOB field (field index 4: between delimiters[3] and delimiters[4])
    // ================================================================
    // DOB format: "DD-MM-YYYY" (10 chars)
    // We extract the year (last 4 digits before the delimiter)

    // Extract birth year: last 4 bytes before delimiter[4]
    signal birthYearStart;
    birthYearStart <== delimiterPositions[4] - 4;

    component yearExtractor = ExtractBytes(maxDataBytes, 4);
    for (var i = 0; i < maxDataBytes; i++) {
        yearExtractor.data[i] <== data[i];
    }
    yearExtractor.start <== birthYearStart;
    yearExtractor.len <== 4;

    component yearParser = AsciiDigitsToNumber(4);
    for (var i = 0; i < 4; i++) {
        yearParser.digits[i] <== yearExtractor.out[i];
    }

    // Check age
    component ageCheck = AgeChecker();
    ageCheck.birthYear <== yearParser.value;
    ageCheck.documentYear <== documentYear;

    // Conditionally reveal
    component revealAge = ConditionalReveal();
    revealAge.value <== ageCheck.isAbove18;
    revealAge.revealFlag <== revealAgeAbove18;
    ageAbove18 <== revealAge.out;

    // ================================================================
    // STEP 3 — Extract gender field (field index 5: between delimiters[4] and delimiters[5])
    // ================================================================
    signal genderBytePos;
    genderBytePos <== delimiterPositions[4] + 1;

    component genderSelector = ByteSelector(maxDataBytes);
    for (var i = 0; i < maxDataBytes; i++) {
        genderSelector.data[i] <== data[i];
    }
    genderSelector.index <== genderBytePos;

    component genderEnc = GenderEncoder();
    genderEnc.genderByte <== genderSelector.out;

    component revealGend = ConditionalReveal();
    revealGend.value <== genderEnc.genderCode;
    revealGend.revealFlag <== revealGender;
    gender <== revealGend.out;

    // ================================================================
    // STEP 4 — Extract pincode (field index 11: between delimiters[10] and delimiters[11])
    // ================================================================
    signal pincodeStart;
    pincodeStart <== delimiterPositions[10] + 1;

    component pincodeExtractor = ExtractBytes(maxDataBytes, 6);
    for (var i = 0; i < maxDataBytes; i++) {
        pincodeExtractor.data[i] <== data[i];
    }
    pincodeExtractor.start <== pincodeStart;
    pincodeExtractor.len <== 6;

    component pincodeParser = AsciiDigitsToNumber(6);
    for (var i = 0; i < 6; i++) {
        pincodeParser.digits[i] <== pincodeExtractor.out[i];
    }

    component revealPin = ConditionalReveal();
    revealPin.value <== pincodeParser.value;
    revealPin.revealFlag <== revealPinCode;
    pinCode <== revealPin.out;

    // ================================================================
    // STEP 5 — Extract state (field index 13: between delimiters[12] and delimiters[13])
    // ================================================================
    // State is a variable-length string. We pack it into a field element.
    signal stateStart;
    stateStart <== delimiterPositions[12] + 1;

    signal stateLength;
    stateLength <== delimiterPositions[13] - delimiterPositions[12] - 1;

    // Extract state bytes (max 64 chars)
    component stateExtractor = ExtractBytes(maxDataBytes, 64);
    for (var i = 0; i < maxDataBytes; i++) {
        stateExtractor.data[i] <== data[i];
    }
    stateExtractor.start <== stateStart;
    stateExtractor.len <== stateLength;

    // Pack state bytes into a single field element (simple weighted sum for short strings)
    // For strings ≤ 31 bytes, this fits in a single BN128 field element
    signal stateAccum[65];
    stateAccum[0] <== 0;
    for (var i = 0; i < 64; i++) {
        stateAccum[i + 1] <== stateAccum[i] * 256 + stateExtractor.out[i];
    }

    component revealSt = ConditionalReveal();
    revealSt.value <== stateAccum[64];
    revealSt.revealFlag <== revealState;
    state <== revealSt.out;

    // ================================================================
    // STEP 6 — Compute photo hash for nullifier
    // ================================================================
    // The photo bytes are at data[photoStart..photoStart+photoLength-1].
    // We extract them and hash using Poseidon.
    // Since Poseidon can only take a small number of inputs per invocation,
    // we pack photo bytes into field elements (31 bytes each) and hash iteratively.
    //
    // This is done in the nullifier sub-circuit (nullifier.circom).
    // Here we just pass through the photoStart and photoLength.
    // The photoHash output is computed by the nullifier component in the main circuit.
    photoHash <== 0; // Placeholder — actual hash computed in main circuit via nullifier.circom
}
