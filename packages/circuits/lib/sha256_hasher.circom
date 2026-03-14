pragma circom 2.1.0;

include "circomlib/circuits/sha256/sha256compression.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/gates.circom";

/// @title Sha256Hasher
/// @notice Computes SHA-256 hash of a variable-length byte array
/// @param maxBytes Maximum input byte length (prover pads unused bytes with 0)
/// @dev Uses block-by-block compression with dynamic final-state selection.
///      The prover provides the actual data length; the circuit applies SHA-256
///      padding in-circuit and selects the correct intermediate state.
///      Constraint cost: ~28,000 per 64-byte block + overhead for padding logic.
template Sha256Hasher(maxBytes) {
    // ---- constants ----
    // Maximum number of SHA-256 blocks needed (message + 1-bit + 64-bit length)
    var maxBits        = maxBytes * 8;
    var maxBlocks      = ((maxBits + 64) \ 512) + 1;
    var totalBits      = maxBlocks * 512;
    var totalBytes     = totalBits \ 8;

    // ---- signals ----
    signal input  data[maxBytes];   // message bytes (0-padded beyond dataLength)
    signal input  dataLength;       // actual byte count
    signal output hash[256];        // SHA-256 hash as 256 bits (big-endian)

    // ================================================================
    // STEP 1 — Build the padded bit stream in-circuit
    // ================================================================
    // Expand every byte to 8 bits (big-endian per byte)
    signal bits[totalBits];

    component byteToBits[maxBytes];
    for (var i = 0; i < maxBytes; i++) {
        byteToBits[i] = Num2Bits(8);
        byteToBits[i].in <== data[i];
        for (var j = 0; j < 8; j++) {
            bits[i * 8 + (7 - j)] <== byteToBits[i].out[j];
        }
    }

    // Zero-fill the rest of the bit array (padding area)
    for (var i = maxBytes * 8; i < totalBits; i++) {
        bits[i] <== 0;
    }

    // ----- SHA-256 padding -----
    // After the message: set bit at position dataLength*8 to 1 (the 0x80 byte)
    // Then zeros, then 64-bit big-endian length at the end of the correct block.
    //
    // We build the padded bits as a *masked overlay*:
    //   paddedBits[i] = messageBit[i]  if i < dataLength*8
    //                   1              if i == dataLength*8
    //                   lengthBit      if i is in the last-64-bits of the target block
    //                   0              otherwise

    // Compute which block is the "last" block (0-indexed)
    // lastBlock = floor((dataLength*8 + 64) / 512)
    // (the block that will contain the 64-bit length suffix)
    signal dataBits;
    dataBits <== dataLength * 8;

    // For position masking we need per-bit comparisons. To avoid O(totalBits)
    // comparisons (expensive), we use the following strategy:
    //   1. Build the complete padded message byte-by-byte
    //   2. Convert to bits
    //   3. Feed into SHA-256 compression blocks

    // Build padded message bytes
    signal paddedBytes[totalBytes];

    // For each byte position, determine if it's:
    //   pos < dataLength        → data[pos]
    //   pos == dataLength       → 0x80
    //   pos > dataLength AND in length suffix → length byte
    //   otherwise               → 0x00

    // Compute the padded length (number of bytes in the padded message)
    // paddedByteLen = ceil((dataLength + 1 + 8) / 64) * 64
    // But we compute this more carefully:
    // After data: 1 byte (0x80) + zeros + 8 bytes (length)
    // Total must be multiple of 64 bytes
    // If dataLength + 1 + 8 <= 64*currentBlock, fits in current block
    // Otherwise need next block

    // We precompute the 8-byte big-endian representation of (dataLength * 8)
    // dataLength fits in 32 bits for our use case, so top 4 bytes are zero
    component lengthBits = Num2Bits(64);
    lengthBits.in <== dataBits;

    // Build length bytes (big-endian, 8 bytes)
    signal lengthBytes[8];
    component lengthByteAssemble[8];
    for (var i = 0; i < 8; i++) {
        lengthByteAssemble[i] = Bits2Num(8);
        for (var j = 0; j < 8; j++) {
            // Big-endian: byte 0 is most significant
            lengthByteAssemble[i].in[j] <== lengthBits.out[(7 - i) * 8 + j];
        }
        lengthBytes[i] <== lengthByteAssemble[i].out;
    }

    // For each byte position, we need to know its role
    component isBeforeEnd[totalBytes];
    component isAtEnd[totalBytes];
    for (var i = 0; i < totalBytes; i++) {
        isBeforeEnd[i] = LessThan(32);
        isBeforeEnd[i].in[0] <== i;
        isBeforeEnd[i].in[1] <== dataLength;

        isAtEnd[i] = IsEqual();
        isAtEnd[i].in[0] <== i;
        isAtEnd[i].in[1] <== dataLength;
    }

    // Compute the target block index (0-based): the block that will hold the length suffix
    // targetBlock = floor((dataLength + 8) / 64)
    // The prover provides this as a hint, and we constrain it.
    signal targetBlock;
    targetBlock <-- (dataLength + 8) \ 64;

    // Constrain targetBlock: targetBlock * 64 <= dataLength + 8 < (targetBlock + 1) * 64
    signal tbOffset;
    tbOffset <== dataLength + 8;
    signal tbLower;
    tbLower <== targetBlock * 64;
    signal tbRemainder;
    tbRemainder <== tbOffset - tbLower;
    // tbRemainder must be in [0, 63] — 6 bits suffice
    component tbRemBits = Num2Bits(6);
    tbRemBits.in <== tbRemainder;

    // The length suffix starts at byte: (targetBlock + 1) * 64 - 8
    signal lengthSuffixStart;
    lengthSuffixStart <== (targetBlock + 1) * 64 - 8;

    // Build padded message bytes with data, 0x80 padding, and length suffix
    // For each byte position, determine:
    //   pos < dataLength        → data[pos]
    //   pos == dataLength       → 0x80
    //   pos in [lengthSuffixStart, lengthSuffixStart+7] → length byte
    //   otherwise               → 0x00

    // Per-byte: check if this position is one of the 8 length suffix bytes
    component isLenPos[totalBytes][8];
    signal lenMatch[totalBytes][8];
    signal lenByteContrib[totalBytes][8 + 1];

    for (var i = 0; i < totalBytes; i++) {
        lenByteContrib[i][0] <== 0;
        for (var k = 0; k < 8; k++) {
            isLenPos[i][k] = IsEqual();
            isLenPos[i][k].in[0] <== i;
            isLenPos[i][k].in[1] <== lengthSuffixStart + k;
            lenMatch[i][k] <== isLenPos[i][k].out * lengthBytes[k];
            lenByteContrib[i][k + 1] <== lenByteContrib[i][k] + lenMatch[i][k];
        }
    }

    for (var i = 0; i < totalBytes; i++) {
        if (i < maxBytes) {
            // Could be data byte, 0x80 byte, length byte, or padding zero
            paddedBytes[i] <== data[i] * isBeforeEnd[i].out
                             + 128 * isAtEnd[i].out
                             + lenByteContrib[i][8];
            // When i > dataLength: both isBeforeEnd and isAtEnd are 0,
            // so only length suffix contribution (if any) remains
        } else {
            // Beyond maxBytes: could still be length suffix position or padding zero
            paddedBytes[i] <== lenByteContrib[i][8];
        }
    }

    // ================================================================
    // STEP 2 — Convert padded bytes to bits and process through SHA-256
    // ================================================================

    // Convert paddedBytes to bits
    signal paddedBits[totalBits];
    component padByteToBits[totalBytes];
    for (var i = 0; i < totalBytes; i++) {
        padByteToBits[i] = Num2Bits(8);
        padByteToBits[i].in <== paddedBytes[i];
        for (var j = 0; j < 8; j++) {
            paddedBits[i * 8 + (7 - j)] <== padByteToBits[i].out[j];
        }
    }

    // ================================================================
    // STEP 3 — SHA-256 block-by-block compression
    // ================================================================

    // SHA-256 initial hash values (H0..H7) as 256 bits
    // H0=0x6a09e667, H1=0xbb67ae85, H2=0x3c6ef372, H3=0xa54ff53a
    // H4=0x510e527f, H5=0x9b05688c, H6=0x1f83d9ab, H7=0x5be0cd19
    var IV[8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    // Convert IV to 256 bits
    signal initState[256];
    for (var w = 0; w < 8; w++) {
        for (var b = 0; b < 32; b++) {
            initState[w * 32 + b] <== (IV[w] >> (31 - b)) & 1;
        }
    }

    // Compression rounds
    component compress[maxBlocks];
    for (var blk = 0; blk < maxBlocks; blk++) {
        compress[blk] = Sha256compression();

        // Input state
        for (var i = 0; i < 256; i++) {
            if (blk == 0) {
                compress[blk].hin[i] <== initState[i];
            } else {
                compress[blk].hin[i] <== compress[blk - 1].out[i];
            }
        }

        // Block data (512 bits)
        for (var i = 0; i < 512; i++) {
            compress[blk].inp[i] <== paddedBits[blk * 512 + i];
        }
    }

    // ================================================================
    // STEP 4 — Select the correct final state
    // ================================================================
    // The correct output is from the block that contains the length suffix
    // (i.e., targetBlock). We use per-block equality checks to select
    // the right compression state via a multiplexer pattern.

    component blockEq[maxBlocks];
    signal blockMatch[maxBlocks];

    for (var blk = 0; blk < maxBlocks; blk++) {
        blockEq[blk] = IsEqual();
        blockEq[blk].in[0] <== targetBlock;
        blockEq[blk].in[1] <== blk;
        blockMatch[blk] <== blockEq[blk].out;
    }

    // For each hash bit, sum over all blocks: blockMatch[blk] * compress[blk].out[i]
    // Exactly one blockMatch is 1, so this selects the correct block's output.
    signal hashAccum[256][maxBlocks + 1];
    for (var i = 0; i < 256; i++) {
        hashAccum[i][0] <== 0;
        for (var blk = 0; blk < maxBlocks; blk++) {
            hashAccum[i][blk + 1] <== hashAccum[i][blk] + blockMatch[blk] * compress[blk].out[i];
        }
        hash[i] <== hashAccum[i][maxBlocks];
    }
}

/// @title Sha256HashChunks
/// @notice Wrapper that outputs the SHA-256 hash as 4 x 64-bit chunks
///         (convenient for RSA comparison)
template Sha256HashChunks(maxBytes) {
    signal input  data[maxBytes];
    signal input  dataLength;
    signal output hashChunks[4]; // 4 x 64-bit chunks, big-endian word order

    component hasher = Sha256Hasher(maxBytes);
    for (var i = 0; i < maxBytes; i++) {
        hasher.data[i] <== data[i];
    }
    hasher.dataLength <== dataLength;

    // Pack 256 bits into 4 x 64-bit chunks
    component pack[4];
    for (var c = 0; c < 4; c++) {
        pack[c] = Bits2Num(64);
        for (var b = 0; b < 64; b++) {
            pack[c].in[b] <== hasher.hash[c * 64 + (63 - b)];
        }
        hashChunks[c] <== pack[c].out;
    }
}
