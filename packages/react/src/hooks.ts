/**
 * @module @anoncitizen/react/hooks
 * React hooks for AnonCitizen proof generation and verification.
 */

import { useState, useCallback } from "react";
import type {
  AnonCitizenProof,
  ProofRequest,
  VerificationResult,
  ContractCalldata,
  AadhaarQRPayload,
} from "@anoncitizen/core";
import { useAnonCitizenContext } from "./context.js";

// ============================================================
// useAnonCitizen
// ============================================================

export interface UseAnonCitizenReturn {
  /** Whether the SDK is initialized and ready */
  isReady: boolean;
  /** Initialization error */
  error: Error | null;
  /** Parse a QR code into structured data */
  parseQR: (qrData: Uint8Array | string) => Promise<AadhaarQRPayload>;
  /** Generate a ZK proof */
  prove: (request: ProofRequest) => Promise<AnonCitizenProof>;
  /** Verify a proof off-chain */
  verify: (proof: AnonCitizenProof) => Promise<VerificationResult>;
  /** Format proof for on-chain contract call */
  formatForContract: (proof: AnonCitizenProof) => ContractCalldata;
}

/**
 * Main hook providing access to all AnonCitizen SDK methods.
 *
 * @example
 * ```tsx
 * const { isReady, prove, verify } = useAnonCitizen();
 *
 * const proof = await prove({
 *   qrData: rawBytes,
 *   nullifierSeed: 42n,
 *   revealAgeAbove18: true,
 * });
 *
 * const result = await verify(proof);
 * ```
 */
export function useAnonCitizen(): UseAnonCitizenReturn {
  const { sdk, isReady, error } = useAnonCitizenContext();

  const parseQR = useCallback(
    async (qrData: Uint8Array | string) => {
      if (!sdk) throw new Error("SDK not initialized");
      return sdk.parseQR(qrData);
    },
    [sdk]
  );

  const prove = useCallback(
    async (request: ProofRequest) => {
      if (!sdk) throw new Error("SDK not initialized");
      return sdk.prove(request);
    },
    [sdk]
  );

  const verify = useCallback(
    async (proof: AnonCitizenProof) => {
      if (!sdk) throw new Error("SDK not initialized");
      return sdk.verify(proof);
    },
    [sdk]
  );

  const formatForContract = useCallback(
    (proof: AnonCitizenProof) => {
      if (!sdk) throw new Error("SDK not initialized");
      return sdk.formatForContract(proof);
    },
    [sdk]
  );

  return { isReady, error, parseQR, prove, verify, formatForContract };
}

// ============================================================
// useProofGeneration
// ============================================================

export type ProofStatus = "idle" | "parsing" | "generating" | "complete" | "error";

export interface UseProofGenerationReturn {
  /** Current status of proof generation */
  status: ProofStatus;
  /** The generated proof (available when status is "complete") */
  proof: AnonCitizenProof | null;
  /** Error message (available when status is "error") */
  error: string | null;
  /** Start proof generation */
  generate: (request: ProofRequest) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Manages the proof generation lifecycle with state tracking.
 *
 * @example
 * ```tsx
 * const { status, proof, error, generate, reset } = useProofGeneration();
 *
 * return (
 *   <div>
 *     <button onClick={() => generate({ qrData, nullifierSeed: 42n })}
 *       disabled={status === "generating"}>
 *       Generate Proof
 *     </button>
 *     {status === "generating" && <p>Generating proof...</p>}
 *     {status === "complete" && <p>Proof ready!</p>}
 *     {status === "error" && <p>Error: {error}</p>}
 *   </div>
 * );
 * ```
 */
export function useProofGeneration(): UseProofGenerationReturn {
  const { sdk } = useAnonCitizenContext();
  const [status, setStatus] = useState<ProofStatus>("idle");
  const [proof, setProof] = useState<AnonCitizenProof | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (request: ProofRequest) => {
      if (!sdk) {
        setError("SDK not initialized");
        setStatus("error");
        return;
      }

      try {
        setStatus("parsing");
        setError(null);
        setProof(null);

        setStatus("generating");
        const result = await sdk.prove(request);

        setProof(result);
        setStatus("complete");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Proof generation failed");
        setStatus("error");
      }
    },
    [sdk]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setProof(null);
    setError(null);
  }, []);

  return { status, proof, error, generate, reset };
}

// ============================================================
// useVerification
// ============================================================

export type VerifyStatus = "idle" | "verifying" | "verified" | "invalid" | "error";

export interface UseVerificationReturn {
  /** Current verification status */
  status: VerifyStatus;
  /** Verification result (available when status is "verified") */
  result: VerificationResult | null;
  /** Error message */
  error: string | null;
  /** Verify a proof off-chain */
  verifyOffChain: (proof: AnonCitizenProof) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Manages the proof verification lifecycle.
 *
 * @example
 * ```tsx
 * const { status, result, verifyOffChain } = useVerification();
 *
 * await verifyOffChain(proof);
 * if (result?.valid) {
 *   console.log("Age above 18:", result.ageAbove18);
 * }
 * ```
 */
export function useVerification(): UseVerificationReturn {
  const { sdk } = useAnonCitizenContext();
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyOffChain = useCallback(
    async (proof: AnonCitizenProof) => {
      if (!sdk) {
        setError("SDK not initialized");
        setStatus("error");
        return;
      }

      try {
        setStatus("verifying");
        setError(null);
        setResult(null);

        const verifyResult = await sdk.verify(proof);
        setResult(verifyResult);
        setStatus(verifyResult.valid ? "verified" : "invalid");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed");
        setStatus("error");
      }
    },
    [sdk]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, verifyOffChain, reset };
}
