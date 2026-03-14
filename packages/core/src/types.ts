/**
 * @module @anoncitizen/core/types
 * All public TypeScript types for the AnonCitizen SDK.
 */

// ============================================================
// Groth16 Proof Types
// ============================================================

/** Raw Groth16 proof object from snarkjs */
export interface Groth16Proof {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol: "groth16";
  curve: "bn128";
}

/** Public signals array (string representations of field elements) */
export type PublicSignals = string[];

/** Complete proof output from proof generation */
export interface AnonCitizenProof {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
}

// ============================================================
// Input Types
// ============================================================

/** Configuration for the AnonCitizen SDK instance */
export interface AnonCitizenConfig {
  /** URL or path to the circuit WASM file */
  wasmUrl: string;
  /** URL or path to the circuit zkey file */
  zkeyUrl: string;
  /** Verification key JSON (bundled or fetched) */
  verificationKey?: VerificationKey;
  /** URL to fetch the verification key if not provided inline */
  verificationKeyUrl?: string;
}

/** Verification key JSON structure from snarkjs */
export interface VerificationKey {
  protocol: "groth16";
  curve: "bn128";
  nPublic: number;
  vk_alpha_1: string[];
  vk_beta_2: string[][];
  vk_gamma_2: string[][];
  vk_delta_2: string[][];
  vk_alphabeta_12: string[][][];
  IC: string[][];
}

/** Request to generate a proof */
export interface ProofRequest {
  /** Raw QR code data (image bytes for decoding, or pre-decoded BigInt string) */
  qrData: Uint8Array | string;
  /** Optional signal to bind to the proof (default: "1") */
  signal?: string;
  /** Application-specific nullifier seed */
  nullifierSeed: bigint;
  /** Reveal whether age >= 18 (default: false) */
  revealAgeAbove18?: boolean;
  /** Reveal gender (default: false) */
  revealGender?: boolean;
  /** Reveal state (default: false) */
  revealState?: boolean;
  /** Reveal PIN code (default: false) */
  revealPinCode?: boolean;
}

// ============================================================
// Parsed QR Types
// ============================================================

/** Parsed Aadhaar QR code payload */
export interface AadhaarQRPayload {
  /** QR format version */
  version: string;
  /** Email/mobile hash indicator (0=neither, 1=email, 2=mobile, 3=both) */
  emailMobileIndicator: number;
  /** Reference ID */
  referenceId: string;
  /** Full name */
  name: string;
  /** Date of birth (DD-MM-YYYY) */
  dob: string;
  /** Gender: M, F, or T */
  gender: string;
  /** Care of / guardian */
  careOf: string;
  /** District */
  district: string;
  /** Landmark */
  landmark: string;
  /** House number */
  house: string;
  /** Location/locality */
  location: string;
  /** 6-digit PIN code */
  pinCode: string;
  /** Post office */
  postOffice: string;
  /** State name */
  state: string;
  /** Street */
  street: string;
  /** Sub-district */
  subDistrict: string;
  /** Village/Town/City */
  vtc: string;
  /** Raw signed data bytes (everything except last 256 bytes) */
  signedData: Uint8Array;
  /** Raw RSA signature bytes (last 256 bytes) */
  signature: Uint8Array;
  /** Photo bytes (JPEG 2000) */
  photo: Uint8Array;
  /** Email hash bytes (32 bytes, if present) */
  emailHash?: Uint8Array;
  /** Mobile hash bytes (32 bytes, if present) */
  mobileHash?: Uint8Array;
  /** Byte positions of 0xFF delimiters in the decompressed payload */
  delimiterPositions: number[];
  /** Byte offset where photo data starts */
  photoStart: number;
}

// ============================================================
// Output Types
// ============================================================

/** Gender encoding (matches circuit output) */
export enum Gender {
  NotRevealed = 0,
  Male = 1,
  Female = 2,
  Transgender = 3,
}

/** Result of proof verification (off-chain) */
export interface VerificationResult {
  /** Whether the proof is valid */
  valid: boolean;
  /** Unique identifier for this (identity, scope) pair */
  nullifier: bigint;
  /** UNIX UTC timestamp from the Aadhaar document */
  timestamp: number;
  /** Hash of the UIDAI RSA public key used */
  pubKeyHash: bigint;
  /** Hash of the bound signal */
  signalHash: bigint;
  /** Application-provided nullifier seed */
  nullifierSeed: bigint;
  /** Whether age >= 18 (undefined if not revealed) */
  ageAbove18?: boolean;
  /** Gender (undefined if not revealed) */
  gender?: Gender;
  /** State name/code (undefined if not revealed) */
  state?: bigint;
  /** 6-digit PIN code (undefined if not revealed) */
  pinCode?: number;
}

// ============================================================
// Contract Calldata Types
// ============================================================

/** Proof formatted for Solidity contract call */
export interface ContractCalldata {
  pA: [string, string];
  pB: [[string, string], [string, string]];
  pC: [string, string];
  pubSignals: string[];
}

// ============================================================
// Public Signal Index Map
// ============================================================

/**
 * Maps public signal names to their array indices.
 * Must match the circuit output signal declaration order.
 */
export const PUBLIC_SIGNAL_INDEX = {
  nullifier: 0,
  timestamp: 1,
  pubKeyHash: 2,
  signalHash: 3,
  nullifierSeed: 4,
  ageAbove18: 5,
  gender: 6,
  state: 7,
  pinCode: 8,
} as const;

/** Total number of public signals */
export const NUM_PUBLIC_SIGNALS = 9;

// ============================================================
// RSA Types
// ============================================================

/** RSA public key in circuit-compatible format */
export interface RSAPublicKey {
  /** Raw modulus bytes (256 bytes for RSA-2048) */
  modulus: Uint8Array;
  /** Modulus as BigInt limbs for the circuit */
  modulusLimbs: bigint[];
  /** Public exponent (always 65537) */
  exponent: number;
}

/** Circuit input signals (formatted for snarkjs.groth16.fullProve) */
export interface CircuitInputs {
  [key: string]: string | string[];
  signedData: string[];
  signedDataLength: string;
  signature: string[];
  delimiterPositions: string[];
  photoStart: string;
  photoLength: string;
  timestampStart: string;
  pubKey: string[];
  signalHash: string;
  nullifierSeed: string;
  revealAgeAbove18: string;
  revealGender: string;
  revealState: string;
  revealPinCode: string;
  documentYear: string;
}
