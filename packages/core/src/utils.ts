/**
 * @module @anoncitizen/core/utils
 * Utility functions: signal hashing, nullifier seed generation, Poseidon helpers.
 */

// ============================================================
// Constants
// ============================================================

/** BN128 scalar field modulus (SNARK_SCALAR_FIELD) */
export const SNARK_SCALAR_FIELD = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

// ============================================================
// Signal Hashing
// ============================================================

/**
 * Hash a signal string to a field element using Poseidon.
 * This produces the signalHash public input for the circuit.
 *
 * Default signal is "1" (no specific signal binding).
 *
 * Uses Poseidon hashing (via circomlibjs) for collision resistance,
 * matching the circuit's field arithmetic.
 *
 * @param signal - The signal string to hash
 * @returns Field element as bigint
 */
export async function hashSignal(signal: string): Promise<bigint> {
  return hashSignalPoseidon(signal);
}

/**
 * Hash a signal using Poseidon (requires circomlibjs).
 * This is the production implementation that matches the circuit.
 *
 * @param signal - The signal to hash
 * @returns Poseidon hash as bigint
 */
export async function hashSignalPoseidon(signal: string): Promise<bigint> {
  // Dynamically import circomlibjs for Poseidon
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();

  const signalBigInt = stringToBigInt(signal);
  const hash = poseidon([signalBigInt]);

  return BigInt(poseidon.F.toString(hash));
}

// ============================================================
// Nullifier Seed
// ============================================================

/**
 * Generate a deterministic nullifier seed from an application identifier.
 * Each application should use a unique seed to prevent cross-app nullifier correlation.
 *
 * @param appId - Application identifier (e.g., domain name, contract address)
 * @returns Deterministic nullifier seed as bigint
 */
export function generateNullifierSeed(appId: string): bigint {
  const seed = stringToBigInt(appId);
  // Ensure non-zero (circuit rejects zero seeds)
  const result = seed % SNARK_SCALAR_FIELD;
  return result === BigInt(0) ? BigInt(1) : result;
}

// ============================================================
// Conversion Helpers
// ============================================================

/**
 * Convert a string to a BigInt by treating it as UTF-8 bytes.
 */
export function stringToBigInt(str: string): bigint {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let result = BigInt(0);
  for (const byte of bytes) {
    result = (result << BigInt(8)) | BigInt(byte);
  }
  return result;
}

/**
 * Convert a BigInt to a hex string (without 0x prefix).
 */
export function bigintToHex(value: bigint): string {
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = "0" + hex;
  return hex;
}

/**
 * Convert a hex string to a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const padded = clean.length % 2 !== 0 ? "0" + clean : clean;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert a Uint8Array to a hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Pack bytes into field elements (31 bytes per element, matching circuit's PackBytes).
 */
export function packBytesToFieldElements(bytes: Uint8Array): bigint[] {
  const BYTES_PER_ELEMENT = 31;
  const elements: bigint[] = [];

  for (let i = 0; i < bytes.length; i += BYTES_PER_ELEMENT) {
    const chunk = bytes.slice(i, i + BYTES_PER_ELEMENT);
    let value = BigInt(0);
    for (const byte of chunk) {
      value = (value << BigInt(8)) | BigInt(byte);
    }
    elements.push(value);
  }

  return elements;
}
