/**
 * @module @anoncitizen/core/prover
 * Proof generation: prepares circuit inputs and calls snarkjs.groth16.fullProve.
 */

import type {
  AadhaarQRPayload,
  AnonCitizenProof,
  CircuitInputs,
  Groth16Proof,
  ProofRequest,
  RSAPublicKey,
} from "./types.js";
import { bytesToLimbs } from "./pre-verify.js";
import { hashSignal } from "./utils.js";

/** Maximum signed data bytes (must match circuit template parameter) */
const MAX_DATA_BYTES = 512;
/** Maximum photo bytes for nullifier (must match circuit template parameter) */
const MAX_PHOTO_BYTES = 256;
/** RSA limb bit size */
const LIMB_BITS = 64;
/** Number of RSA limbs */
const NUM_LIMBS = 32;

/**
 * Generate an AnonCitizen ZK proof from a parsed QR payload.
 *
 * @param payload - Parsed Aadhaar QR payload
 * @param publicKey - UIDAI RSA public key (circuit-compatible format)
 * @param request - Proof generation options (signal, nullifier seed, reveal flags)
 * @param wasmPath - Path or URL to the circuit WASM file
 * @param zkeyPath - Path or URL to the circuit zkey file
 * @returns Generated proof and public signals
 * @throws If proof generation fails
 */
export async function generateProof(
  payload: AadhaarQRPayload,
  publicKey: RSAPublicKey,
  request: ProofRequest,
  wasmPath: string,
  zkeyPath: string
): Promise<AnonCitizenProof> {
  // Dynamically import snarkjs to support both Node.js and browser
  const snarkjs = await import("snarkjs");

  // Prepare circuit inputs
  const inputs = await prepareCircuitInputs(payload, publicKey, request);

  // Generate the proof
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    wasmPath,
    zkeyPath
  );

  return { proof: proof as unknown as Groth16Proof, publicSignals };
}

/**
 * Prepare all circuit input signals from the parsed QR data and proof request.
 */
export async function prepareCircuitInputs(
  payload: AadhaarQRPayload,
  publicKey: RSAPublicKey,
  request: ProofRequest
): Promise<CircuitInputs> {
  // Pad signed data to MAX_DATA_BYTES
  const signedData = padArray(payload.signedData, MAX_DATA_BYTES);
  const signedDataLength = payload.signedData.length;

  // Convert RSA signature to BigInt limbs
  const signatureLimbs = bytesToLimbs(
    payload.signature,
    LIMB_BITS,
    NUM_LIMBS
  );

  // Compute signal hash (Poseidon for collision resistance)
  const signal = request.signal ?? "1";
  const signalHashValue = await hashSignal(signal);

  // Extract document year from DOB or reference ID for age calculation
  const documentYear = extractDocumentYear(payload);

  // Find timestamp position in the signed data
  const timestampStart = findTimestampStart(payload);

  return {
    // Private inputs
    signedData: signedData.map((b) => b.toString()),
    signedDataLength: signedDataLength.toString(),
    signature: signatureLimbs.map((l) => l.toString()),
    delimiterPositions: payload.delimiterPositions.map((p) => p.toString()),
    photoStart: payload.photoStart.toString(),
    photoLength: Math.min(
      payload.photo.length,
      MAX_PHOTO_BYTES
    ).toString(),
    timestampStart: timestampStart.toString(),

    // Public inputs
    pubKey: publicKey.modulusLimbs.map((l) => l.toString()),
    signalHash: signalHashValue.toString(),
    nullifierSeed: request.nullifierSeed.toString(),
    revealAgeAbove18: request.revealAgeAbove18 ? "1" : "0",
    revealGender: request.revealGender ? "1" : "0",
    revealState: request.revealState ? "1" : "0",
    revealPinCode: request.revealPinCode ? "1" : "0",
    documentYear: documentYear.toString(),
  };
}

/**
 * Pad a Uint8Array to a target length with zeros.
 */
function padArray(data: Uint8Array, targetLength: number): number[] {
  const padded = new Array(targetLength).fill(0);
  for (let i = 0; i < Math.min(data.length, targetLength); i++) {
    padded[i] = data[i];
  }
  return padded;
}

/**
 * Extract the document year for age calculation.
 * Uses the current year as a reasonable approximation for age checking.
 */
function extractDocumentYear(payload: AadhaarQRPayload): number {
  // Try to extract year from reference ID (contains timestamp info)
  // Reference ID format varies; use current year as fallback
  const currentYear = new Date().getFullYear();

  // Check if reference ID starts with a 4-digit year
  const refYear = parseInt(payload.referenceId.substring(0, 4), 10);
  if (refYear >= 2000 && refYear <= currentYear + 1) {
    return refYear;
  }

  return currentYear;
}

/**
 * Find the byte offset of the timestamp in the signed data.
 * The timestamp is typically embedded in the reference ID field.
 */
function findTimestampStart(payload: AadhaarQRPayload): number {
  // Reference ID is field[2], which starts after delimiter[1] + 1
  // The timestamp digits are at the start of the reference ID
  if (payload.delimiterPositions.length >= 2) {
    return payload.delimiterPositions[1] + 1;
  }
  return 0;
}
