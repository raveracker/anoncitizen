#!/bin/bash
set -euo pipefail

# AnonCitizen Trusted Setup Script
# Downloads Powers of Tau and generates proving/verification keys

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCUIT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$CIRCUIT_DIR/build"
ARTIFACTS_DIR="$CIRCUIT_DIR/artifacts"

# Configuration
# ptau file size depends on constraint count:
#   2^12 = 4,096 constraints
#   2^16 = 65,536 constraints
#   2^20 = 1,048,576 constraints
#   2^23 = 8,388,608 constraints (needed for production ~5M constraints)
#
# For testing (512-byte data), 2^20 should suffice.
# For production (16384-byte data), use 2^23.
PTAU_SIZE="${PTAU_SIZE:-20}"
PTAU_FILE="powersOfTau28_hez_final_${PTAU_SIZE}.ptau"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/${PTAU_FILE}"

echo "=== AnonCitizen Trusted Setup ==="
echo "ptau size: 2^${PTAU_SIZE}"

# Verify build artifacts exist
if [ ! -f "$BUILD_DIR/aadhaar-verifier.r1cs" ]; then
    echo "ERROR: R1CS file not found. Run 'bash scripts/compile.sh' first."
    exit 1
fi

mkdir -p "$BUILD_DIR" "$ARTIFACTS_DIR"

# Step 1: Download Powers of Tau (if not cached)
echo ""
echo "[1/5] Downloading Powers of Tau (2^${PTAU_SIZE})..."
if [ -f "$BUILD_DIR/$PTAU_FILE" ]; then
    echo "  Already cached: $BUILD_DIR/$PTAU_FILE"
else
    echo "  Downloading from Hermez ceremony..."
    curl -L -o "$BUILD_DIR/$PTAU_FILE" "$PTAU_URL"
    echo "  Downloaded: $BUILD_DIR/$PTAU_FILE"
fi

# Step 2: Groth16 Phase 2 setup (circuit-specific)
echo ""
echo "[2/5] Running Groth16 Phase 2 setup..."
snarkjs groth16 setup \
    "$BUILD_DIR/aadhaar-verifier.r1cs" \
    "$BUILD_DIR/$PTAU_FILE" \
    "$BUILD_DIR/aadhaar-verifier_0000.zkey"

# Step 3: Contribute to Phase 2 (adds randomness)
echo ""
echo "[3/5] Contributing to Phase 2..."
snarkjs zkey contribute \
    "$BUILD_DIR/aadhaar-verifier_0000.zkey" \
    "$BUILD_DIR/aadhaar-verifier_final.zkey" \
    --name="AnonCitizen Phase 2 contribution" \
    -v -e="$(head -c 64 /dev/urandom | xxd -p)"

# Step 4: Export verification key
echo ""
echo "[4/5] Exporting verification key..."
snarkjs zkey export verificationkey \
    "$BUILD_DIR/aadhaar-verifier_final.zkey" \
    "$ARTIFACTS_DIR/verification_key.json"
echo "  Saved: $ARTIFACTS_DIR/verification_key.json"

# Step 5: Export Solidity verifier
echo ""
echo "[5/5] Exporting Solidity verifier..."
snarkjs zkey export solidityverifier \
    "$BUILD_DIR/aadhaar-verifier_final.zkey" \
    "$ARTIFACTS_DIR/Groth16Verifier.sol"
echo "  Saved: $ARTIFACTS_DIR/Groth16Verifier.sol"

# Copy final zkey to artifacts
cp "$BUILD_DIR/aadhaar-verifier_final.zkey" "$ARTIFACTS_DIR/aadhaar-verifier.zkey"

# Print summary
echo ""
echo "=== Trusted Setup Complete ==="
echo ""
echo "Artifacts:"
echo "  WASM:             $ARTIFACTS_DIR/aadhaar-verifier.wasm"
echo "  zkey:             $ARTIFACTS_DIR/aadhaar-verifier.zkey"
echo "  Verification key: $ARTIFACTS_DIR/verification_key.json"
echo "  Solidity verifier: $ARTIFACTS_DIR/Groth16Verifier.sol"
echo ""
echo "File sizes:"
ls -lh "$ARTIFACTS_DIR/"
echo ""
echo "NOTE: For production, the zkey should be hosted on IPFS/CDN"
echo "      (see docs/decisions/ADR-001-zkey-distribution.md)"
