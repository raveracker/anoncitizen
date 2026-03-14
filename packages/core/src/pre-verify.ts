/**
 * @module @anoncitizen/core/pre-verify
 * Pre-verification: validates the RSA signature outside the circuit
 * as a fast sanity check before expensive proof generation.
 */

import { sha256 } from "@noble/hashes/sha256";
import type { AadhaarQRPayload, RSAPublicKey } from "./types.js";

/** RSA limb size in bits (matches @zk-email/circuits: n=121) */
const LIMB_BITS = 121;
/** Number of limbs for RSA-2048 (matches @zk-email/circuits: k=17, 121*17=2057) */
const NUM_LIMBS = 17;

/**
 * Verify the RSA signature of an Aadhaar QR payload outside the circuit.
 * This is a fast pre-check: if this fails, proof generation will also fail.
 *
 * @param payload - Parsed QR payload containing signedData and signature
 * @param publicKey - UIDAI RSA public key
 * @returns true if the signature is valid
 */
export async function preVerifySignature(
  payload: AadhaarQRPayload,
  publicKey: RSAPublicKey
): Promise<boolean> {
  try {
    // Use Web Crypto API for RSA verification
    const cryptoKey = await importRSAPublicKey(publicKey);

    // .slice() produces Uint8Array<ArrayBuffer> (required by WebCrypto in TS 5.9+)
    const isValid = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      cryptoKey,
      payload.signature.slice(),
      payload.signedData.slice()
    );

    return isValid;
  } catch {
    return false;
  }
}

/**
 * Import an RSA public key into Web Crypto format.
 */
async function importRSAPublicKey(
  publicKey: RSAPublicKey
): Promise<CryptoKey> {
  // Build PKCS#8 / SPKI DER encoding for the RSA public key
  // RSAPublicKey ::= SEQUENCE { modulus INTEGER, publicExponent INTEGER }
  const modulusBytes = publicKey.modulus;
  const exponentBytes = bigintToBytes(BigInt(publicKey.exponent));

  // Encode as JWK for Web Crypto import
  const jwk: JsonWebKey = {
    kty: "RSA",
    n: bytesToBase64url(modulusBytes),
    e: bytesToBase64url(exponentBytes),
    alg: "RS256",
  };

  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

/**
 * Parse an RSA public key from raw modulus bytes.
 *
 * @param modulusBytes - 256-byte RSA-2048 modulus
 * @returns RSAPublicKey with modulus split into circuit-compatible limbs
 */
export function parseRSAPublicKey(modulusBytes: Uint8Array): RSAPublicKey {
  if (modulusBytes.length !== 256) {
    throw new Error(
      `Expected 256-byte modulus (RSA-2048), got ${modulusBytes.length}`
    );
  }

  return {
    modulus: modulusBytes,
    modulusLimbs: bytesToLimbs(modulusBytes, LIMB_BITS, NUM_LIMBS),
    exponent: 65537,
  };
}

/**
 * Parse an RSA public key from a PEM or DER certificate.
 * Extracts the modulus from the X.509 certificate structure.
 *
 * @param certData - Certificate bytes (DER format) or PEM string
 * @returns RSAPublicKey
 */
export function parseRSAPublicKeyFromCert(
  certData: Uint8Array | string
): RSAPublicKey {
  let derBytes: Uint8Array;

  if (typeof certData === "string") {
    // PEM format: strip headers and decode base64
    const pem = certData
      .replace(/-----BEGIN (?:CERTIFICATE|PUBLIC KEY)-----/g, "")
      .replace(/-----END (?:CERTIFICATE|PUBLIC KEY)-----/g, "")
      .replace(/\s/g, "");
    derBytes = base64ToBytes(pem);
  } else {
    derBytes = certData;
  }

  // Extract modulus from DER-encoded X.509 certificate
  // This is a simplified parser that looks for the RSA modulus in the ASN.1 structure
  const modulus = extractModulusFromDER(derBytes);
  return parseRSAPublicKey(modulus);
}

/**
 * Convert bytes to BigInt limbs (little-endian limb order).
 * Each limb is `limbBits` bits wide.
 */
export function bytesToLimbs(
  bytes: Uint8Array,
  limbBits: number,
  numLimbs: number
): bigint[] {
  // Convert bytes to a single BigInt (big-endian byte order)
  let value = BigInt(0);
  for (const byte of bytes) {
    value = (value << BigInt(8)) | BigInt(byte);
  }

  // Split into limbs (little-endian: limb[0] is least significant)
  const limbMask = (BigInt(1) << BigInt(limbBits)) - BigInt(1);
  const limbs: bigint[] = [];
  for (let i = 0; i < numLimbs; i++) {
    limbs.push(value & limbMask);
    value >>= BigInt(limbBits);
  }

  return limbs;
}

/**
 * Compute SHA-256 hash of the signed data (matches circuit Stage 1).
 */
export function hashSignedData(signedData: Uint8Array): Uint8Array {
  return sha256(signedData);
}

// ============================================================
// Utility functions
// ============================================================

function bigintToBytes(value: bigint): Uint8Array {
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = "0" + hex;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extract RSA modulus from DER-encoded X.509 certificate.
 * Looks for the RSA modulus in the SubjectPublicKeyInfo structure.
 */
function extractModulusFromDER(der: Uint8Array): Uint8Array {
  // Simple ASN.1 parser: find the RSA modulus
  // RSA modulus is typically the first large INTEGER (256+ bytes) in the cert
  for (let i = 0; i < der.length - 260; i++) {
    // Look for INTEGER tag (0x02) followed by length encoding for 256+ bytes
    if (der[i] === 0x02) {
      let len = 0;
      let offset = i + 1;

      if (der[offset] === 0x82) {
        // Two-byte length
        len = (der[offset + 1] << 8) | der[offset + 2];
        offset += 3;
      } else if (der[offset] === 0x81) {
        // One-byte length
        len = der[offset + 1];
        offset += 2;
      }

      // RSA-2048 modulus is 256 or 257 bytes (257 if leading zero for sign)
      if (len >= 256 && len <= 258) {
        // Skip leading zero byte if present
        if (der[offset] === 0x00) {
          offset++;
          len--;
        }
        if (len === 256) {
          return der.slice(offset, offset + 256);
        }
      }
    }
  }

  throw new Error("Could not extract RSA modulus from certificate");
}
