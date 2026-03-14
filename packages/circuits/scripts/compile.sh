#!/bin/bash
set -euo pipefail

# AnonCitizen Circuit Compilation Script
# Compiles the aadhaar-verifier circuit and produces artifacts

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCUIT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$CIRCUIT_DIR/build"
ARTIFACTS_DIR="$CIRCUIT_DIR/artifacts"

# Resolve circomlib path from node_modules
NODE_MODULES="$CIRCUIT_DIR/node_modules"

echo "=== AnonCitizen Circuit Compilation ==="
echo "Circuit dir: $CIRCUIT_DIR"
echo "Build dir:   $BUILD_DIR"

# Create output directories
mkdir -p "$BUILD_DIR" "$ARTIFACTS_DIR"

# Step 1: Compile the circuit
echo ""
echo "[1/3] Compiling aadhaar-verifier.circom..."
circom "$CIRCUIT_DIR/aadhaar-verifier.circom" \
    --r1cs \
    --wasm \
    --sym \
    --output "$BUILD_DIR" \
    -l "$NODE_MODULES"

# Step 2: Print circuit info (may OOM on large circuits — non-critical)
echo ""
echo "[2/3] Circuit info:"
NODE_OPTIONS="--max-old-space-size=8192" snarkjs r1cs info "$BUILD_DIR/aadhaar-verifier.r1cs" || echo "  (skipped — r1cs info ran out of memory, compilation was successful)"

# Step 3: Copy WASM to artifacts
echo ""
echo "[3/3] Copying artifacts..."
cp "$BUILD_DIR/aadhaar-verifier_js/aadhaar-verifier.wasm" "$ARTIFACTS_DIR/"
echo "WASM artifact: $ARTIFACTS_DIR/aadhaar-verifier.wasm"

echo ""
echo "=== Compilation complete ==="
echo "Next step: Run 'bash scripts/setup.sh' to generate proving/verification keys"
