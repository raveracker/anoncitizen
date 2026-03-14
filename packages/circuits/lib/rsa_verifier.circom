pragma circom 2.1.0;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

/// @title BigMul
/// @notice Multiplies two k-limb big integers (each limb is n bits)
/// @param n Bits per limb
/// @param k Number of limbs
/// @dev Output has 2k limbs. Uses schoolbook multiplication with carry-chain
///      decomposition. Each output limb is range-checked to n bits.
///      Constraint cost: O(k^2) + O(k) for carry range checks
template BigMul(n, k) {
    signal input a[k];
    signal input b[k];
    signal output out[2 * k];

    signal partial[k][k];
    for (var i = 0; i < k; i++) {
        for (var j = 0; j < k; j++) {
            partial[i][j] <== a[i] * b[j];
        }
    }

    // Accumulate partial products into output limbs using carry-chain decomposition.
    // For each output position idx, the raw sum of partial products may exceed n bits.
    // We decompose: rawSum[idx] = carry[idx] * 2^n + out[idx]
    // where out[idx] is the n-bit limb and carry[idx] propagates to the next position.
    //
    // The carry can be at most ~k * (2^n - 1)^2 / 2^n which fits in n + log2(k) bits.
    // We use log2(k) + n bits for carry range checks (conservative upper bound).

    // Compute the maximum number of partial products contributing to any single limb.
    // At most k terms contribute (when idx is in range [k-1..k]).
    // Each partial product is at most (2^n - 1)^2 < 2^(2n).
    // So raw sum < k * 2^(2n), meaning carry < k * 2^n, needing n + ceil(log2(k)) bits.

    // We need ceil(log2(k)) extra bits for carry. Compute conservatively.
    var carry_extra_bits = 0;
    var kk = k;
    while (kk > 1) {
        carry_extra_bits++;
        kk = (kk + 1) \ 2; // integer ceil division
    }
    var carry_bits = n + carry_extra_bits;

    signal carry[2 * k];
    component limbRangeCheck[2 * k];
    component carryRangeCheck[2 * k];

    // For position 0, there's no incoming carry
    // rawSum[0] = partial[0][0] = carry[0] * 2^n + out[0]
    // For position idx > 0:
    // rawSum[idx] + carry[idx-1] = carry[idx] * 2^n + out[idx]

    signal rawSum[2 * k];
    for (var idx = 0; idx < 2 * k; idx++) {
        var s = 0;
        for (var i = 0; i < k; i++) {
            var j = idx - i;
            if (j >= 0 && j < k) {
                s += partial[i][j];
            }
        }
        // s is a linear combination of signals (partial products), so this is constrained
        rawSum[idx] <== s;
    }

    for (var idx = 0; idx < 2 * k; idx++) {
        // Prover hints for carry and limb
        if (idx == 0) {
            carry[idx] <-- rawSum[idx] >> n;
            out[idx] <-- rawSum[idx] - (carry[idx] * (1 << n));
        } else {
            carry[idx] <-- (rawSum[idx] + carry[idx - 1]) >> n;
            out[idx] <-- (rawSum[idx] + carry[idx - 1]) - (carry[idx] * (1 << n));
        }

        // Range check: out[idx] fits in n bits
        limbRangeCheck[idx] = Num2Bits(n);
        limbRangeCheck[idx].in <== out[idx];

        // Range check: carry[idx] fits in carry_bits bits
        carryRangeCheck[idx] = Num2Bits(carry_bits);
        carryRangeCheck[idx].in <== carry[idx];

        // Constrain the decomposition: rawSum + incoming_carry = carry * 2^n + out
        if (idx == 0) {
            rawSum[idx] === carry[idx] * (1 << n) + out[idx];
        } else {
            rawSum[idx] + carry[idx - 1] === carry[idx] * (1 << n) + out[idx];
        }
    }

    // The final carry must be zero (product fits in 2k limbs of n bits)
    carry[2 * k - 1] === 0;
}

/// @title BigMod
/// @notice Computes a mod p where a has 2k limbs and p has k limbs
/// @param n Bits per limb
/// @param k Number of limbs in modulus
/// @dev Prover provides quotient and remainder as hints; circuit verifies a = q*p + r.
///      Quotient has at most k+1 limbs (since a < 2^(2kn) and p >= 2^((k-1)n)).
///      Constraint cost: O(k^2) for BigMul + O(k) for carry chain + range checks
template BigMod(n, k) {
    signal input a[2 * k];     // dividend (2k limbs)
    signal input p[k];         // modulus  (k limbs)
    signal output remainder[k]; // a mod p

    // Prover computes quotient and remainder as witness hints
    signal quotient[k + 1];

    // Hint: compute quotient and remainder using big integer arithmetic
    // We reconstruct the big integers from limbs for the prover computation.
    //
    // NOTE: This hint computation uses field arithmetic which works correctly
    // because the prover operates over the full field. The circuit constraints
    // below are what actually enforce correctness.
    var aLimbs[200]; // large enough buffer for intermediate computation
    var pLimbs[200];
    for (var i = 0; i < 2 * k; i++) {
        aLimbs[i] = a[i];
    }
    for (var i = 0; i < k; i++) {
        pLimbs[i] = p[i];
    }

    // Long division to compute quotient and remainder in limb representation.
    // We perform digit-by-digit division from the most significant limb.
    var rLimbs[200]; // running remainder in limbs
    var qLimbs[200]; // quotient limbs
    for (var i = 0; i < 200; i++) {
        rLimbs[i] = 0;
        qLimbs[i] = 0;
    }

    // Simple approach: use the fact that a = q * p + r.
    // We compute q = a / p and r = a % p using repeated subtraction in limb form.
    // For the prover hint, we use a polynomial evaluation trick:
    // Evaluate a, p as integers mod a large power of 2, compute q and r.
    //
    // Practical prover hint: evaluate as field elements and do division.
    // The prover is trusted to provide correct hints; the constraints verify them.
    var aVal = 0;
    var pVal = 0;
    var power = 1;
    for (var i = 0; i < 2 * k; i++) {
        aVal += a[i] * power;
        if (i < k) {
            pVal += p[i] * power;
        }
        power *= (1 << n);
    }
    var qVal = aVal \ pVal;  // integer division
    var rVal = aVal % pVal;  // remainder

    // Decompose quotient and remainder into limbs
    var qTmp = qVal;
    for (var i = 0; i < k + 1; i++) {
        quotient[i] <-- qTmp % (1 << n);
        qTmp = qTmp \ (1 << n);
    }
    var rTmp = rVal;
    for (var i = 0; i < k; i++) {
        remainder[i] <-- rTmp % (1 << n);
        rTmp = rTmp \ (1 << n);
    }

    // === CONSTRAINTS ===

    // 1. Range check: each quotient limb fits in n bits
    component qRangeCheck[k + 1];
    for (var i = 0; i < k + 1; i++) {
        qRangeCheck[i] = Num2Bits(n);
        qRangeCheck[i].in <== quotient[i];
    }

    // 2. Range check: each remainder limb fits in n bits
    component rRangeCheck[k];
    for (var i = 0; i < k; i++) {
        rRangeCheck[i] = Num2Bits(n);
        rRangeCheck[i].in <== remainder[i];
    }

    // 3. Verify: a === quotient * p + remainder
    //    We compute quotient * p using BigMul, then add remainder,
    //    and verify equality with a, all using carry-chain decomposition.

    // Compute q * p. Quotient has k+1 limbs, p has k limbs.
    // We pad quotient to (k+1) limbs and p to (k+1) limbs for BigMul.
    // Result has 2*(k+1) limbs.
    component qp = BigMul(n, k + 1);
    for (var i = 0; i < k + 1; i++) {
        qp.a[i] <== quotient[i];
    }
    for (var i = 0; i < k; i++) {
        qp.b[i] <== p[i];
    }
    // Pad p with a zero limb
    qp.b[k] <== 0;

    // Now verify: a === qp.out + remainder (as big integers)
    // qp.out has 2*(k+1) limbs, a has 2*k limbs, remainder has k limbs.
    // We verify limb-by-limb with carry propagation.
    // For each limb position idx:
    //   qp.out[idx] + remainder_ext[idx] + carry_in = a_ext[idx] + borrow * 2^n
    // Rearranged: qp.out[idx] + remainder_ext[idx] + carry_in - a_ext[idx] = borrow * 2^n
    // Since a = q*p + r, the total must match exactly, so we use addition carry chain.
    //
    // Equivalently: (q*p + r)[idx] with carries must equal a[idx] for all positions.

    // Compute qp + r with carry chain, verify each limb equals a
    var total_limbs = 2 * (k + 1); // number of limbs in qp.out
    signal addCarry[total_limbs + 1];
    signal addResult[total_limbs];
    component addLimbCheck[total_limbs];
    component addCarryCheck[total_limbs];

    // Carry bit size: at most 1 bit since we're adding n-bit numbers
    // Actually carry can be 0 or 1 from addition of two n-bit numbers
    addCarry[0] <== 0;

    var carry_add_bits = 0;
    var kkk = k + 2;
    while (kkk > 1) {
        carry_add_bits++;
        kkk = (kkk + 1) \ 2;
    }
    var add_carry_size = carry_add_bits + 1; // conservative

    for (var idx = 0; idx < total_limbs; idx++) {
        // Sum at this position: qp.out[idx] + remainder(extended) + carry_in
        // remainder is only k limbs; extend with 0 for higher limbs
        var rExt = 0;
        if (idx < k) {
            rExt = 1; // flag: use remainder[idx]
        }

        // a is only 2*k limbs; extend with 0 for higher limbs
        // We need: qp[idx] + r_ext[idx] + carry_in === a_ext[idx] + carry_out * 2^n

        if (idx < k) {
            // Both remainder and a contribute
            addResult[idx] <-- (qp.out[idx] + remainder[idx] + addCarry[idx]) % (1 << n);
            addCarry[idx + 1] <-- (qp.out[idx] + remainder[idx] + addCarry[idx]) >> n;
            qp.out[idx] + remainder[idx] + addCarry[idx] === addCarry[idx + 1] * (1 << n) + addResult[idx];
        } else if (idx < 2 * k) {
            // Only qp contributes (no remainder above k limbs)
            addResult[idx] <-- (qp.out[idx] + addCarry[idx]) % (1 << n);
            addCarry[idx + 1] <-- (qp.out[idx] + addCarry[idx]) >> n;
            qp.out[idx] + addCarry[idx] === addCarry[idx + 1] * (1 << n) + addResult[idx];
        } else {
            // Above 2*k: only qp.out contributes, a is 0
            addResult[idx] <-- (qp.out[idx] + addCarry[idx]) % (1 << n);
            addCarry[idx + 1] <-- (qp.out[idx] + addCarry[idx]) >> n;
            qp.out[idx] + addCarry[idx] === addCarry[idx + 1] * (1 << n) + addResult[idx];
        }

        // Range check result limb (n bits)
        addLimbCheck[idx] = Num2Bits(n);
        addLimbCheck[idx].in <== addResult[idx];

        // Range check carry (small, a few bits)
        addCarryCheck[idx] = Num2Bits(add_carry_size);
        addCarryCheck[idx].in <== addCarry[idx + 1];

        // Verify result matches the corresponding limb of a
        if (idx < 2 * k) {
            addResult[idx] === a[idx];
        } else {
            addResult[idx] === 0;
        }
    }

    // Final carry must be zero
    addCarry[total_limbs] === 0;

    // 4. Verify remainder < p (remainder must be strictly less than modulus)
    //    We check this using a borrow-chain subtraction: compute p - r - 1 and verify
    //    all limbs are non-negative (i.e., the result is >= 0, meaning p - 1 >= r, i.e., r < p).
    signal diffBorrow[k + 1];
    signal diffLimb[k];
    component diffLimbCheck[k];
    component diffBorrowCheck[k];

    diffBorrow[0] <== 0;
    for (var i = 0; i < k; i++) {
        // Compute p[i] - remainder[i] - borrow_in - (1 if i==0 else 0)
        // This effectively computes p - r - 1
        var sub_one = 0;
        if (i == 0) {
            sub_one = 1;
        }

        diffLimb[i] <-- (p[i] - remainder[i] - diffBorrow[i] - sub_one + (1 << n)) % (1 << n);
        diffBorrow[i + 1] <-- (p[i] - remainder[i] - diffBorrow[i] - sub_one < 0) ? 1 : 0;

        // Constrain: p[i] - remainder[i] - borrow_in - sub_one + borrow_out * 2^n = diffLimb[i]
        p[i] - remainder[i] - diffBorrow[i] - sub_one + diffBorrow[i + 1] * (1 << n) === diffLimb[i];

        // Range check: diffLimb[i] is n bits (non-negative and fits)
        diffLimbCheck[i] = Num2Bits(n);
        diffLimbCheck[i].in <== diffLimb[i];

        // Range check: borrow is 0 or 1
        diffBorrowCheck[i] = Num2Bits(1);
        diffBorrowCheck[i].in <== diffBorrow[i + 1];
    }

    // Final borrow must be 0 (meaning p - r - 1 >= 0, i.e., r < p)
    diffBorrow[k] === 0;
}

/// @title BigModExp65537
/// @notice Computes base^65537 mod modulus using square-and-multiply
/// @param n Bits per limb
/// @param k Number of limbs
/// @dev 65537 = 2^16 + 1, so: base^65537 = base * (base^(2^16))
///      This requires 16 squarings + 1 multiplication.
///      Constraint cost: ~150,000-200,000 for n=64, k=32
template BigModExp65537(n, k) {
    signal input base[k];
    signal input modulus[k];
    signal output out[k];

    // Square 16 times: base^2, base^4, ..., base^(2^16)
    signal squares[17][k]; // squares[0] = base, squares[i] = base^(2^i) mod n
    for (var i = 0; i < k; i++) {
        squares[0][i] <== base[i];
    }

    component squareMul[16];
    component squareMod[16];
    for (var i = 0; i < 16; i++) {
        squareMul[i] = BigMul(n, k);
        for (var j = 0; j < k; j++) {
            squareMul[i].a[j] <== squares[i][j];
            squareMul[i].b[j] <== squares[i][j];
        }

        squareMod[i] = BigMod(n, k);
        for (var j = 0; j < 2 * k; j++) {
            squareMod[i].a[j] <== squareMul[i].out[j];
        }
        for (var j = 0; j < k; j++) {
            squareMod[i].p[j] <== modulus[j];
        }

        for (var j = 0; j < k; j++) {
            squares[i + 1][j] <== squareMod[i].remainder[j];
        }
    }

    // Final multiplication: base * base^(2^16) mod modulus
    component finalMul = BigMul(n, k);
    for (var j = 0; j < k; j++) {
        finalMul.a[j] <== base[j];
        finalMul.b[j] <== squares[16][j];
    }

    component finalMod = BigMod(n, k);
    for (var j = 0; j < 2 * k; j++) {
        finalMod.a[j] <== finalMul.out[j];
    }
    for (var j = 0; j < k; j++) {
        finalMod.p[j] <== modulus[j];
    }

    for (var j = 0; j < k; j++) {
        out[j] <== finalMod.remainder[j];
    }
}

/// @title RSAVerifier
/// @notice Verifies an RSA-2048 PKCS#1 v1.5 signature with SHA-256
/// @param n Bits per limb (recommended: 64)
/// @param k Number of limbs (recommended: 32 for 2048-bit RSA)
/// @dev Verifies: signature^65537 mod pubkey == PKCS1v15Pad(sha256Hash)
///      The SHA-256 hash is provided as 4 x 64-bit chunks.
///
///      PKCS#1 v1.5 padding for SHA-256 (256-byte padded message):
///      0x00 0x01 [0xFF x 202] 0x00 [DigestInfo(19 bytes)] [Hash(32 bytes)]
///
///      DigestInfo for SHA-256:
///      30 31 30 0d 06 09 60 86 48 01 65 03 04 02 01 05 00 04 20
///
///      Constraint cost: ~200,000 (dominated by modular exponentiation)
template RSAVerifier(n, k) {
    signal input hashChunks[4];    // SHA-256 hash as 4 x 64-bit chunks
    signal input signature[k];     // RSA signature limbs
    signal input pubkey[k];        // RSA public key modulus limbs

    // Step 1: Compute signature^65537 mod pubkey
    component modExp = BigModExp65537(n, k);
    for (var i = 0; i < k; i++) {
        modExp.base[i] <== signature[i];
        modExp.modulus[i] <== pubkey[i];
    }

    // Step 2: Construct the expected PKCS#1 v1.5 padded message
    // The padded message is 256 bytes = 2048 bits, stored as k limbs of n bits
    //
    // Byte layout (big-endian):
    // [0x00][0x01][0xFF x 202][0x00][DigestInfo 19B][Hash 32B]
    //
    // DigestInfo for SHA-256:
    // 0x30 0x31 0x30 0x0d 0x06 0x09 0x60 0x86
    // 0x48 0x01 0x65 0x03 0x04 0x02 0x01 0x05
    // 0x00 0x04 0x20
    //
    // We construct this as limbs and compare with the RSA output.

    // For the comparison, we verify each limb of the RSA output matches
    // the expected padded message.
    //
    // The hash occupies the lowest 32 bytes (4 limbs of 64 bits = 256 bits).
    // We verify the hash limbs match hashChunks, and the upper limbs match
    // the fixed PKCS padding.

    // Verify hash portion (lowest 4 limbs contain the SHA-256 hash)
    // Note: limb ordering is little-endian (limb[0] is least significant)
    for (var i = 0; i < 4; i++) {
        modExp.out[i] === hashChunks[3 - i];
    }

    // Verify DigestInfo (next 3 limbs, 19 bytes + 5 bytes of padding context)
    // DigestInfo + 0x00 separator + start of 0xFF padding
    // Exact limb values depend on byte alignment within 64-bit limbs.
    //
    // The DigestInfo bytes (19 bytes) starting from byte 32:
    // Byte 32-50: 0x30 0x31 0x30 0x0d 0x06 0x09 0x60 0x86
    //             0x48 0x01 0x65 0x03 0x04 0x02 0x01 0x05
    //             0x00 0x04 0x20
    // Byte 51: 0x00 (separator)
    // Bytes 52-253: 0xFF (padding, 202 bytes)
    // Byte 254: 0x01
    // Byte 255: 0x00

    // Pre-computed expected limb values for PKCS#1 v1.5 SHA-256 padding
    // (2048-bit RSA, 64-bit limbs, little-endian limb order)
    //
    // These constants are computed from the byte layout above.
    // Limb[4]: bytes 32-39 of padded message (first 8 bytes of DigestInfo)
    // Limb[5]: bytes 40-47
    // Limb[6]: bytes 48-55 (end of DigestInfo + separator + start of 0xFF)
    // Limbs[7..30]: all 0xFFFFFFFFFFFFFFFF (pure 0xFF padding)
    // Limb[31]: 0x0001FFFFFFFFFFFF (0x00 0x01 0xFF 0xFF 0xFF 0xFF 0xFF 0xFF)

    // Verify padding limbs (7..30 should all be 0xFFFFFFFFFFFFFFFF)
    for (var i = 7; i < k - 1; i++) {
        modExp.out[i] === 0xFFFFFFFFFFFFFFFF;
    }

    // Verify top limb (0x0001...)
    // Exact value depends on alignment; the top 2 bytes are 0x00 0x01
    // For 2048-bit key with 64-bit limbs:
    // Limb[31] = 0x0001FFFFFFFFFFFF
    modExp.out[k - 1] === 0x0001FFFFFFFFFFFF;

    // Verify DigestInfo limbs (4, 5, 6)
    // These are fixed constants derived from the PKCS#1 v1.5 padding for SHA-256
    // with a 2048-bit (256-byte) RSA modulus.
    //
    // Full big-endian byte layout (256 bytes):
    //   Byte 0: 0x00, Byte 1: 0x01, Bytes 2-203: 0xFF (202 bytes),
    //   Byte 204: 0x00 (separator),
    //   Bytes 205-223: DigestInfo (19 bytes), Bytes 224-255: SHA-256 hash (32 bytes)
    //
    // DigestInfo for SHA-256 (19 bytes):
    //   30 31 30 0D 06 09 60 86 48 01 65 03 04 02 01 05 00 04 20
    //
    // Limbs are 64-bit, little-endian. Limb j covers LE bytes [j*8 .. j*8+7].
    // LE byte i corresponds to big-endian byte (255 - i).
    //
    // Limb 4: LE bytes [32..39] = BE bytes [223..216]
    //   BE 216=0x03, 217=0x04, 218=0x02, 219=0x01, 220=0x05, 221=0x00, 222=0x04, 223=0x20
    //   LE order in limb: [0x20, 0x04, 0x00, 0x05, 0x01, 0x02, 0x04, 0x03]
    //   = 0x0304020105000420
    //
    // Limb 5: LE bytes [40..47] = BE bytes [215..208]
    //   BE 208=0x0D, 209=0x06, 210=0x09, 211=0x60, 212=0x86, 213=0x48, 214=0x01, 215=0x65
    //   LE order in limb: [0x65, 0x01, 0x48, 0x86, 0x60, 0x09, 0x06, 0x0D]
    //   = 0x0D06096086480165
    //
    // Limb 6: LE bytes [48..55] = BE bytes [207..200]
    //   BE 200=0xFF, 201=0xFF, 202=0xFF, 203=0xFF, 204=0x00, 205=0x30, 206=0x31, 207=0x30
    //   LE order in limb: [0x30, 0x31, 0x30, 0x00, 0xFF, 0xFF, 0xFF, 0xFF]
    //   = 0xFFFFFFFF00303130
    modExp.out[4] === 0x0304020105000420;
    modExp.out[5] === 0x0D06096086480165;
    modExp.out[6] === 0xFFFFFFFF00303130;
}
