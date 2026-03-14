/**
 * Integration tests using real UIDAI certificates.
 *
 * No mocks — exercises the actual certificate parsing and crypto code.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import {
  parseRSAPublicKeyFromCert,
  bytesToLimbs,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, "../assets");

const secureQrCert = readFileSync(resolve(assetsDir, "uidai-secure-qr.cer"), "utf8");
const offlineEkycCert = readFileSync(resolve(assetsDir, "uidai-offline-ekyc.cer"), "utf8");

describe("UIDAI Certificate Parsing", () => {
  it("should parse the Secure QR certificate", () => {
    const key = parseRSAPublicKeyFromCert(secureQrCert);

    expect(key.modulus).toHaveLength(256);
    expect(key.modulusLimbs).toHaveLength(17);
    expect(key.exponent).toBe(65537);
    for (const limb of key.modulusLimbs) {
      expect(limb).toBeGreaterThanOrEqual(0n);
    }
  });

  it("should parse the Offline eKYC certificate", () => {
    const key = parseRSAPublicKeyFromCert(offlineEkycCert);

    expect(key.modulus).toHaveLength(256);
    expect(key.modulusLimbs).toHaveLength(17);
    expect(key.exponent).toBe(65537);
  });

  it("should produce different moduli for the two certificates", () => {
    const secureKey = parseRSAPublicKeyFromCert(secureQrCert);
    const ekycKey = parseRSAPublicKeyFromCert(offlineEkycCert);

    expect(secureKey.modulus).not.toEqual(ekycKey.modulus);
    expect(secureKey.modulusLimbs).not.toEqual(ekycKey.modulusLimbs);
  });

  it("should produce limbs consistent with direct bytesToLimbs", () => {
    const key = parseRSAPublicKeyFromCert(offlineEkycCert);
    const directLimbs = bytesToLimbs(key.modulus, 121, 17);
    expect(key.modulusLimbs).toEqual(directLimbs);
  });

  it("should reconstruct the full modulus from limbs", () => {
    const key = parseRSAPublicKeyFromCert(offlineEkycCert);

    let reconstructed = 0n;
    for (let i = key.modulusLimbs.length - 1; i >= 0; i--) {
      reconstructed = (reconstructed << 121n) | key.modulusLimbs[i];
    }

    let fromBytes = 0n;
    for (const byte of key.modulus) {
      fromBytes = (fromBytes << 8n) | BigInt(byte);
    }

    expect(reconstructed).toBe(fromBytes);
  });
});
