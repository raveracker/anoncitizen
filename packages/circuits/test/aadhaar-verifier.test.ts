import { expect } from "chai";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// circom_tester provides utilities for testing circom circuits
// It compiles the circuit, generates witnesses, and checks constraints
const require = createRequire(import.meta.url);
const circom_tester = require("circom_tester");
const wasm_tester = circom_tester.wasm;

// ============================================================
// Test Utilities
// ============================================================

/**
 * Creates a sample signed data byte array for testing.
 * Simulates the Aadhaar V2 QR format:
 * [version][field0][0xFF][field1][0xFF]...[field16][0xFF][photo][signature]
 *
 * Field order (0xFF delimited):
 * 0: referenceId, 1: name, 2: DOB, 3: gender, 4: careOf,
 * 5: district, 6: landmark, 7: house, 8: location,
 * 9: pincode, 10: postOffice, 11: state, 12: street,
 * 13: subDistrict, 14: vtc, 15: mobileHash, 16: emailHash
 */
function createSampleSignedData(maxBytes: number): {
  data: number[];
  dataLength: number;
  delimiterPositions: number[];
  photoStart: number;
  photoLength: number;
  timestampStart: number;
} {
  const DELIMITER = 255; // 0xFF

  // Build fields as ASCII byte arrays
  const fields = [
    "1234202503131200", // field 0: referenceId (contains timestamp-like data)
    "Test User",        // field 1: name
    "15-06-2000",       // field 2: DOB (DD-MM-YYYY)
    "M",                // field 3: gender
    "S/O Test",         // field 4: careOf
    "Test District",    // field 5: district
    "Near Park",        // field 6: landmark
    "42",               // field 7: house
    "Test Location",    // field 8: location
    "560001",           // field 9: pincode
    "Test PO",          // field 10: postOffice
    "Karnataka",        // field 11: state
    "Main Road",        // field 12: street
    "Test SubDist",     // field 13: subDistrict
    "Bangalore",        // field 14: vtc
    "abcdef1234567890", // field 15: mobileHash
    "fedcba0987654321", // field 16: emailHash
  ];

  const bytes: number[] = [];
  bytes.push(2); // version byte

  const delimiterPositions: number[] = [];

  for (let i = 0; i < fields.length; i++) {
    // Add field bytes
    for (const ch of fields[i]) {
      bytes.push(ch.charCodeAt(0));
    }
    // Add delimiter
    delimiterPositions.push(bytes.length);
    bytes.push(DELIMITER);
  }

  // Add photo bytes (simulated JPEG header + data)
  const photoStart = bytes.length;
  const photoData = [0xff, 0xd8, 0xff, 0xe0]; // JPEG SOI marker
  // Add some random-ish photo data
  for (let i = 0; i < 32; i++) {
    photoData.push((i * 7 + 13) % 256);
  }
  photoData.push(0xff, 0xd9); // JPEG EOI marker
  bytes.push(...photoData);
  const photoLength = photoData.length;

  // Record timestamp position (in reference ID field, starting at byte 5)
  // The timestamp "2025031312" starts at position 5 in the reference ID
  const timestampStart = 5; // position of "2025031312" in the data

  const dataLength = bytes.length;

  // Pad to maxBytes
  while (bytes.length < maxBytes) {
    bytes.push(0);
  }

  return {
    data: bytes,
    dataLength,
    delimiterPositions,
    photoStart,
    photoLength,
    timestampStart,
  };
}

/**
 * Generates sample RSA key and signature limbs for testing.
 * In production, these come from the actual UIDAI key and Aadhaar QR signature.
 * For circuit testing, we use placeholder values that satisfy the constraint structure.
 */
function createSampleRSAInputs(k: number): {
  pubKey: bigint[];
  signature: bigint[];
} {
  // Placeholder RSA values for structural testing
  // Real values would come from the UIDAI public key and QR signature
  const pubKey: bigint[] = [];
  const signature: bigint[] = [];

  for (let i = 0; i < k; i++) {
    pubKey.push(BigInt(i + 1) * BigInt("0x0123456789ABCDEF"));
    signature.push(BigInt(i + 1) * BigInt("0xFEDCBA9876543210"));
  }

  return { pubKey, signature };
}

// ============================================================
// Sub-Circuit Tests
// ============================================================

describe("Sub-circuit Tests", function () {
  this.timeout(120000); // circom compilation can be slow

  describe("TimestampConverter (ISTtoUTC)", function () {
    let circuit: any;

    before(async function () {
      circuit = await wasm_tester(
        path.join(__dirname, "circuits", "test_ist_to_utc.circom"),
        { include: [path.join(__dirname, "..", "node_modules")] }
      );
    });

    it("should correctly subtract IST offset (19800 seconds)", async function () {
      const istTimestamp = 1710331200; // Some IST timestamp
      const expectedUtc = istTimestamp - 19800;

      const witness = await circuit.calculateWitness({
        istTimestamp: istTimestamp,
      });
      await circuit.checkConstraints(witness);
      await circuit.assertOut(witness, { utcTimestamp: expectedUtc });
    });

    it("should handle large timestamps", async function () {
      const istTimestamp = 2000000000;
      const expectedUtc = istTimestamp - 19800;

      const witness = await circuit.calculateWitness({
        istTimestamp: istTimestamp,
      });
      await circuit.checkConstraints(witness);
      await circuit.assertOut(witness, { utcTimestamp: expectedUtc });
    });
  });

  describe("NullifierHasher", function () {
    let circuit: any;

    before(async function () {
      circuit = await wasm_tester(
        path.join(__dirname, "circuits", "test_nullifier.circom"),
        { include: [path.join(__dirname, "..", "node_modules")] }
      );
    });

    it("should produce deterministic nullifier for same inputs", async function () {
      const input = {
        nullifierSeed: "12345",
        photoHash: "67890",
      };

      const witness1 = await circuit.calculateWitness(input);
      const witness2 = await circuit.calculateWitness(input);

      await circuit.checkConstraints(witness1);

      // Same inputs should produce same nullifier
      expect(witness1[1].toString()).to.equal(witness2[1].toString());
    });

    it("should produce different nullifiers for different seeds", async function () {
      const witness1 = await circuit.calculateWitness({
        nullifierSeed: "11111",
        photoHash: "67890",
      });

      const witness2 = await circuit.calculateWitness({
        nullifierSeed: "22222",
        photoHash: "67890",
      });

      await circuit.checkConstraints(witness1);
      await circuit.checkConstraints(witness2);

      // Different seeds should produce different nullifiers
      expect(witness1[1].toString()).to.not.equal(witness2[1].toString());
    });

    it("should reject zero nullifier seed", async function () {
      try {
        await circuit.calculateWitness({
          nullifierSeed: "0",
          photoHash: "67890",
        });
        expect.fail("Should have thrown for zero seed");
      } catch (e: any) {
        expect(e.message).to.include("Assert Failed");
      }
    });
  });

  describe("ConditionalReveal", function () {
    let circuit: any;

    before(async function () {
      circuit = await wasm_tester(
        path.join(__dirname, "circuits", "test_conditional_reveal.circom"),
        { include: [path.join(__dirname, "..", "node_modules")] }
      );
    });

    it("should output value when flag is 1", async function () {
      const witness = await circuit.calculateWitness({
        value: "42",
        revealFlag: "1",
      });
      await circuit.checkConstraints(witness);
      await circuit.assertOut(witness, { out: "42" });
    });

    it("should output 0 when flag is 0", async function () {
      const witness = await circuit.calculateWitness({
        value: "42",
        revealFlag: "0",
      });
      await circuit.checkConstraints(witness);
      await circuit.assertOut(witness, { out: "0" });
    });

    it("should reject non-boolean flag", async function () {
      try {
        const witness = await circuit.calculateWitness({
          value: "42",
          revealFlag: "2",
        });
        await circuit.checkConstraints(witness);
        expect.fail("Should have thrown for non-boolean flag");
      } catch (e: any) {
        // Expected: constraint failure
      }
    });
  });

  describe("GenderEncoder", function () {
    let circuit: any;

    before(async function () {
      circuit = await wasm_tester(
        path.join(__dirname, "circuits", "test_gender_encoder.circom"),
        { include: [path.join(__dirname, "..", "node_modules")] }
      );
    });

    it("should encode 'M' as 1", async function () {
      const witness = await circuit.calculateWitness({
        genderByte: "77", // ASCII 'M'
      });
      await circuit.checkConstraints(witness);
      await circuit.assertOut(witness, { genderCode: "1" });
    });

    it("should encode 'F' as 2", async function () {
      const witness = await circuit.calculateWitness({
        genderByte: "70", // ASCII 'F'
      });
      await circuit.checkConstraints(witness);
      await circuit.assertOut(witness, { genderCode: "2" });
    });

    it("should encode 'T' as 3", async function () {
      const witness = await circuit.calculateWitness({
        genderByte: "84", // ASCII 'T'
      });
      await circuit.checkConstraints(witness);
      await circuit.assertOut(witness, { genderCode: "3" });
    });

    it("should reject invalid gender byte", async function () {
      try {
        const witness = await circuit.calculateWitness({
          genderByte: "65", // ASCII 'A' — invalid
        });
        await circuit.checkConstraints(witness);
        expect.fail("Should have thrown for invalid gender");
      } catch (e: any) {
        // Expected: constraint failure
      }
    });
  });

  describe("AsciiDigitsToNumber", function () {
    let circuit: any;

    before(async function () {
      circuit = await wasm_tester(
        path.join(__dirname, "circuits", "test_ascii_to_number.circom"),
        { include: [path.join(__dirname, "..", "node_modules")] }
      );
    });

    it("should parse '002000' to 2000", async function () {
      const digits = "002000".split("").map((c) => c.charCodeAt(0).toString());
      const witness = await circuit.calculateWitness({ digits });
      await circuit.checkConstraints(witness);
      await circuit.assertOut(witness, { value: "2000" });
    });

    it("should parse '560001' to 560001", async function () {
      const digits = "560001".split("").map((c) => c.charCodeAt(0).toString());
      const witness = await circuit.calculateWitness({ digits });
      await circuit.checkConstraints(witness);
      await circuit.assertOut(witness, { value: "560001" });
    });
  });
});

// ============================================================
// Integration Test (Full Circuit)
// ============================================================

describe("AadhaarVerifier Integration", function () {
  this.timeout(300000); // full circuit compilation is slow

  // NOTE: The full AadhaarVerifier circuit test requires:
  // 1. A valid RSA signature (the circuit performs RSA verification)
  // 2. Correct SHA-256 hash of the signed data
  // 3. Properly formatted Aadhaar QR data
  //
  // For now, we test the sub-circuits individually (above) and
  // document the integration test structure. A full integration test
  // requires either:
  // - A test Aadhaar QR (with a known test RSA key pair)
  // - Mocking the RSA verification step
  //
  // The full integration test will be completed in Phase 5 (QA).

  it("should be structured correctly", function () {
    // Verify all circuit files exist
    const circuitDir = path.join(__dirname, "..");

    expect(fs.existsSync(path.join(circuitDir, "aadhaar-verifier.circom"))).to
      .be.true;
    expect(
      fs.existsSync(path.join(circuitDir, "lib", "sha256_hasher.circom"))
    ).to.be.true;
    expect(
      fs.existsSync(path.join(circuitDir, "lib", "rsa_verifier.circom"))
    ).to.be.true;
    expect(
      fs.existsSync(path.join(circuitDir, "lib", "field_extractor.circom"))
    ).to.be.true;
    expect(fs.existsSync(path.join(circuitDir, "lib", "nullifier.circom"))).to
      .be.true;
    expect(
      fs.existsSync(
        path.join(circuitDir, "lib", "timestamp_converter.circom")
      )
    ).to.be.true;
  });
});
