/**
 * @anoncitizen/react-native
 *
 * React Native (Expo) hooks and components for AnonCitizen ZK Aadhaar verification.
 *
 * @example
 * ```tsx
 * import {
 *   AnonCitizenProvider,
 *   useAnonCitizen,
 *   useProofGeneration,
 *   CameraQRScanner,
 *   ImageQRScanner,
 *   ProofStatus,
 * } from "@anoncitizen/react-native";
 * ```
 */

// Context & Provider
export { AnonCitizenProvider, useAnonCitizenContext } from "./context.js";
export type { AnonCitizenProviderProps, AnonCitizenContextValue } from "./context.js";

// Hooks
export {
  useAnonCitizen,
  useProofGeneration,
  useVerification,
} from "./hooks.js";
export type {
  UseAnonCitizenReturn,
  UseProofGenerationReturn,
  UseVerificationReturn,
  ProofStatus as ProofStatusType,
  VerifyStatus,
} from "./hooks.js";

// Components
export { CameraQRScanner, ImageQRScanner, ProofStatus } from "./components.js";
export type {
  CameraQRScannerProps,
  ImageQRScannerProps,
  ProofStatusProps,
} from "./components.js";

// Re-export core types that consumers commonly need
export type {
  AnonCitizenConfig,
  ProofRequest,
  AnonCitizenProof,
  VerificationResult,
  ContractCalldata,
  Gender,
} from "@anoncitizen/core";
