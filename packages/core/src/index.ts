/**
 * @anoncitizen/core
 *
 * Core TypeScript SDK for privacy-preserving Aadhaar identity verification
 * using zero-knowledge proofs.
 *
 * @example
 * ```typescript
 * import { AnonCitizen } from "@anoncitizen/core";
 *
 * const ac = new AnonCitizen({
 *   wasmUrl: "/artifacts/aadhaar-verifier.wasm",
 *   zkeyUrl: "/artifacts/aadhaar-verifier.zkey",
 * });
 *
 * // Parse QR code
 * const payload = await ac.parseQR(qrData);
 *
 * // Generate proof
 * const proof = await ac.prove({
 *   qrData,
 *   nullifierSeed: 42n,
 *   revealAgeAbove18: true,
 * });
 *
 * // Verify off-chain
 * const result = await ac.verify(proof);
 * console.log(result.valid, result.ageAbove18);
 * ```
 */

// ---- Types (re-exported) ----
export type {
  AadhaarQRPayload,
  AnonCitizenConfig,
  AnonCitizenProof,
  CircuitInputs,
  ContractCalldata,
  Groth16Proof,
  ProofRequest,
  PublicSignals,
  RSAPublicKey,
  VerificationKey,
  VerificationResult,
} from "./types.js";

export { Gender, PUBLIC_SIGNAL_INDEX, NUM_PUBLIC_SIGNALS } from "./types.js";

// ---- Functions (re-exported) ----
export { parseQRCode } from "./qr-parser.js";
export {
  preVerifySignature,
  parseRSAPublicKey,
  parseRSAPublicKeyFromCert,
  bytesToLimbs,
  hashSignedData,
} from "./pre-verify.js";
export { generateProof, prepareCircuitInputs } from "./prover.js";
export {
  verifyProofOffChain,
  decodePublicSignals,
  formatProofForContract,
} from "./verifier.js";
export {
  hashSignal,
  hashSignalPoseidon,
  generateNullifierSeed,
  stringToBigInt,
  bigintToHex,
  hexToBytes,
  bytesToHex,
  packBytesToFieldElements,
  SNARK_SCALAR_FIELD,
} from "./utils.js";

// ---- Main Class ----
import type {
  AnonCitizenConfig,
  AnonCitizenProof,
  AadhaarQRPayload,
  ProofRequest,
  RSAPublicKey,
  VerificationKey,
  VerificationResult,
} from "./types.js";
import { parseQRCode } from "./qr-parser.js";
import { preVerifySignature, parseRSAPublicKeyFromCert } from "./pre-verify.js";
import { generateProof } from "./prover.js";
import { verifyProofOffChain, formatProofForContract } from "./verifier.js";
import type { ContractCalldata } from "./types.js";

/**
 * Main entry point for the AnonCitizen SDK.
 * Provides a convenient wrapper around the lower-level functions.
 */
export class AnonCitizen {
  private config: AnonCitizenConfig;
  private verificationKey: VerificationKey | null = null;
  private publicKey: RSAPublicKey | null = null;

  constructor(config: AnonCitizenConfig) {
    this.config = config;
    if (config.verificationKey) {
      this.verificationKey = config.verificationKey;
    }
  }

  /**
   * Set the UIDAI RSA public key for signature verification.
   * @param certOrKey - PEM/DER certificate or pre-parsed RSAPublicKey
   */
  setPublicKey(certOrKey: Uint8Array | string | RSAPublicKey): void {
    if (
      typeof certOrKey === "object" &&
      "modulusLimbs" in certOrKey
    ) {
      this.publicKey = certOrKey;
    } else {
      this.publicKey = parseRSAPublicKeyFromCert(
        certOrKey as Uint8Array | string
      );
    }
  }

  /**
   * Parse an Aadhaar QR code into structured data.
   */
  async parseQR(
    qrData: Uint8Array | string
  ): Promise<AadhaarQRPayload> {
    return parseQRCode(qrData);
  }

  /**
   * Pre-verify the RSA signature (fast sanity check before proof generation).
   */
  async preVerify(payload: AadhaarQRPayload): Promise<boolean> {
    if (!this.publicKey) {
      throw new Error(
        "Public key not set. Call setPublicKey() first."
      );
    }
    return preVerifySignature(payload, this.publicKey);
  }

  /**
   * Generate a ZK proof from QR data.
   *
   * @param request - Proof options (QR data, nullifier seed, reveal flags)
   * @returns Generated proof with public signals
   */
  async prove(request: ProofRequest): Promise<AnonCitizenProof> {
    if (!this.publicKey) {
      throw new Error(
        "Public key not set. Call setPublicKey() first."
      );
    }

    // Parse QR if raw data provided
    const payload = await parseQRCode(request.qrData);

    // Pre-verify signature
    const sigValid = await preVerifySignature(payload, this.publicKey);
    if (!sigValid) {
      throw new Error(
        "RSA signature verification failed. The QR data may be invalid or the public key may be wrong."
      );
    }

    return generateProof(
      payload,
      this.publicKey,
      request,
      this.config.wasmUrl,
      this.config.zkeyUrl
    );
  }

  /**
   * Verify a proof off-chain.
   */
  async verify(proof: AnonCitizenProof): Promise<VerificationResult> {
    const vkey = await this.getVerificationKey();
    return verifyProofOffChain(proof, vkey);
  }

  /**
   * Format a proof for on-chain contract verification.
   */
  formatForContract(proof: AnonCitizenProof): ContractCalldata {
    return formatProofForContract(proof);
  }

  /**
   * Get or fetch the verification key.
   */
  private async getVerificationKey(): Promise<VerificationKey> {
    if (this.verificationKey) return this.verificationKey;

    if (this.config.verificationKeyUrl) {
      const response = await fetch(this.config.verificationKeyUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch verification key: ${response.statusText}`
        );
      }
      this.verificationKey = await response.json();
      return this.verificationKey!;
    }

    throw new Error(
      "No verification key configured. Provide verificationKey or verificationKeyUrl in config."
    );
  }
}
