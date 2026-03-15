/**
 * @module @anoncitizen/core/verifier
 * Off-chain proof verification using snarkjs.
 */

import type {
  AnonCitizenProof,
  ContractCalldata,
  VerificationKey,
  VerificationResult,
} from "./types.js";
import { PUBLIC_SIGNAL_INDEX } from "./types.js";

/**
 * Verify an AnonCitizen proof off-chain using snarkjs.
 *
 * @param proof - The proof to verify
 * @param verificationKey - The circuit verification key
 * @returns Verification result with decoded public signals
 */
export async function verifyProofOffChain(
  proof: AnonCitizenProof,
  verificationKey: VerificationKey
): Promise<VerificationResult> {
  const snarkjs = await import("snarkjs");

  const valid = await snarkjs.groth16.verify(
    verificationKey,
    proof.publicSignals,
    proof.proof
  );

  return {
    valid,
    ...decodePublicSignals(proof.publicSignals),
  };
}

/**
 * Decode the public signals array into named, typed fields.
 *
 * @param publicSignals - Raw public signals from proof generation
 * @returns Decoded fields with proper types
 */
export function decodePublicSignals(publicSignals: string[]): Omit<
  VerificationResult,
  "valid"
> {
  const nullifier = BigInt(publicSignals[PUBLIC_SIGNAL_INDEX.nullifier]);
  const timestamp = Number(publicSignals[PUBLIC_SIGNAL_INDEX.timestamp]);
  const pubKeyHash = BigInt(publicSignals[PUBLIC_SIGNAL_INDEX.pubKeyHash]);
  const signalHash = BigInt(publicSignals[PUBLIC_SIGNAL_INDEX.signalHash]);
  const nullifierSeed = BigInt(
    publicSignals[PUBLIC_SIGNAL_INDEX.nullifierSeed]
  );

  const ageAbove18Raw = Number(
    publicSignals[PUBLIC_SIGNAL_INDEX.ageAbove18]
  );
  const genderRaw = Number(publicSignals[PUBLIC_SIGNAL_INDEX.gender]);
  const stateRaw = BigInt(publicSignals[PUBLIC_SIGNAL_INDEX.state]);
  const pinCodeRaw = Number(publicSignals[PUBLIC_SIGNAL_INDEX.pinCode]);

  return {
    nullifier,
    timestamp,
    pubKeyHash,
    signalHash,
    nullifierSeed,
    ageAbove18: ageAbove18Raw !== 0 ? ageAbove18Raw === 1 : undefined,
    gender: genderRaw !== 0 ? decodeGender(genderRaw) : undefined,
    state: stateRaw !== 0n ? decodePackedString(stateRaw) : undefined,
    pinCode: pinCodeRaw !== 0 ? pinCodeRaw : undefined,
  };
}

/**
 * Decode gender code to human-readable string.
 * Circuit outputs: 1=M, 2=F, 3=T
 */
function decodeGender(code: number): string | undefined {
  switch (code) {
    case 1: return "M";
    case 2: return "F";
    case 3: return "T";
    default: return undefined;
  }
}

/**
 * Decode a packed BigInt back to a string.
 * The circuit packs as: accum = accum * 256 + byte (big-endian).
 * To decode: extract bytes from LSB, then reverse.
 */
function decodePackedString(packed: bigint): string {
  const bytes: number[] = [];
  let value = packed;
  while (value > 0n) {
    bytes.push(Number(value & 0xffn));
    value >>= 8n;
  }
  bytes.reverse();
  // Strip trailing null bytes from fixed-width extraction
  while (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
    bytes.pop();
  }
  return String.fromCharCode(...bytes);
}

/**
 * Format a proof for on-chain Solidity contract verification.
 *
 * The B point coordinates are reversed compared to the snarkjs JSON format,
 * as required by the BN254 precompile calling convention.
 *
 * @param proof - The AnonCitizen proof to format
 * @returns Calldata formatted for the AnonCitizen.verifyAndRecord() function
 */
export function formatProofForContract(
  proof: AnonCitizenProof
): ContractCalldata {
  const p = proof.proof;

  return {
    pA: [p.pi_a[0], p.pi_a[1]],
    // Note: B point coordinates are reversed for BN254 precompile
    pB: [
      [p.pi_b[0][1], p.pi_b[0][0]],
      [p.pi_b[1][1], p.pi_b[1][0]],
    ],
    pC: [p.pi_c[0], p.pi_c[1]],
    pubSignals: proof.publicSignals,
  };
}
