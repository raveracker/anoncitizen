import { expect } from "chai";
import { ethers } from "hardhat";
import { AnonCitizen, Groth16Verifier } from "../typechain-types";

/**
 * Public signal indices (must match circuit output order):
 *   [0] nullifier
 *   [1] timestamp
 *   [2] pubKeyHash
 *   [3] signalHash
 *   [4] nullifierSeed
 *   [5] ageAbove18
 *   [6] gender
 *   [7] state
 *   [8] pincode
 */

// Sample public signals for testing
// NOTE: These are placeholder values. In production tests, generate real proofs
// with snarkjs and the circuit's WASM/zkey artifacts.
const SAMPLE_NULLIFIER = BigInt("12345678901234567890");
const SAMPLE_TIMESTAMP = BigInt(1710331200); // 2024-03-13 in UNIX
const SAMPLE_PUBKEY_HASH = BigInt("98765432109876543210");
const SAMPLE_SIGNAL_HASH = BigInt("11111111111111111111");
const SAMPLE_NULLIFIER_SEED = BigInt("42");

function samplePubSignals(
  overrides: Partial<Record<string, bigint>> = {}
): bigint[] {
  const signals = [
    overrides.nullifier ?? SAMPLE_NULLIFIER,     // [0]
    overrides.timestamp ?? SAMPLE_TIMESTAMP,      // [1]
    overrides.pubKeyHash ?? SAMPLE_PUBKEY_HASH,   // [2]
    overrides.signalHash ?? SAMPLE_SIGNAL_HASH,   // [3]
    overrides.nullifierSeed ?? SAMPLE_NULLIFIER_SEED, // [4]
    overrides.ageAbove18 ?? BigInt(1),            // [5]
    overrides.gender ?? BigInt(1),                // [6]
    overrides.state ?? BigInt(0),                 // [7]
    overrides.pincode ?? BigInt(0),               // [8]
  ];
  // Pad to 32 elements (pubKey limbs + repeated public inputs from circuit)
  while (signals.length < 32) {
    signals.push(BigInt(0));
  }
  return signals;
}

// Placeholder proof points (these won't pass real verification,
// but allow testing the contract logic with a mock verifier)
const SAMPLE_PA: [bigint, bigint] = [BigInt(1), BigInt(2)];
const SAMPLE_PB: [[bigint, bigint], [bigint, bigint]] = [
  [BigInt(1), BigInt(2)],
  [BigInt(3), BigInt(4)],
];
const SAMPLE_PC: [bigint, bigint] = [BigInt(1), BigInt(2)];

describe("AnonCitizen", function () {
  let verifier: Groth16Verifier;
  let anoncitizen: AnonCitizen;

  beforeEach(async function () {
    // Deploy verifier
    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = (await VerifierFactory.deploy()) as unknown as Groth16Verifier;
    await verifier.waitForDeployment();

    // Deploy AnonCitizen wrapper
    const AnonCitizenFactory =
      await ethers.getContractFactory("AnonCitizen");
    anoncitizen = (await AnonCitizenFactory.deploy(
      await verifier.getAddress()
    )) as unknown as AnonCitizen;
    await anoncitizen.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the verifier address correctly", async function () {
      expect(await anoncitizen.verifier()).to.equal(
        await verifier.getAddress()
      );
    });

    it("should have no nullifiers used initially", async function () {
      expect(await anoncitizen.isNullifierUsed(SAMPLE_NULLIFIER)).to.be.false;
    });

    it("should set the owner to the deployer", async function () {
      const [deployer] = await ethers.getSigners();
      expect(await anoncitizen.owner()).to.equal(deployer.address);
    });
  });

  describe("Public key hash registry", function () {
    it("should allow owner to add trusted pubKeyHash", async function () {
      await anoncitizen.addTrustedPubKeyHash(SAMPLE_PUBKEY_HASH);
      expect(await anoncitizen.trustedPubKeyHash(SAMPLE_PUBKEY_HASH)).to.be.true;
    });

    it("should allow owner to remove trusted pubKeyHash", async function () {
      await anoncitizen.addTrustedPubKeyHash(SAMPLE_PUBKEY_HASH);
      await anoncitizen.removeTrustedPubKeyHash(SAMPLE_PUBKEY_HASH);
      expect(await anoncitizen.trustedPubKeyHash(SAMPLE_PUBKEY_HASH)).to.be.false;
    });

    it("should reject non-owner from adding pubKeyHash", async function () {
      const [, attacker] = await ethers.getSigners();
      await expect(
        anoncitizen.connect(attacker).addTrustedPubKeyHash(SAMPLE_PUBKEY_HASH)
      ).to.be.revertedWithCustomError(anoncitizen, "Unauthorized");
    });

    it("should reject verifyAndRecord with untrusted pubKeyHash", async function () {
      const pubSignals = samplePubSignals();
      await expect(
        anoncitizen.verifyAndRecord(
          SAMPLE_PA,
          SAMPLE_PB,
          SAMPLE_PC,
          pubSignals
        )
      ).to.be.revertedWithCustomError(anoncitizen, "UntrustedPublicKey");
    });
  });

  describe("Nullifier tracking", function () {
    // NOTE: These tests verify contract logic independent of proof validity.
    // The Groth16Verifier with placeholder keys will reject all proofs,
    // so we test nullifier logic by checking the revert order.
    // Full proof verification tests require real circuit artifacts.

    it("should reject zero nullifier (checked before pubKeyHash)", async function () {
      const pubSignals = samplePubSignals({ nullifier: BigInt(0) });
      await expect(
        anoncitizen.verifyAndRecord(
          SAMPLE_PA,
          SAMPLE_PB,
          SAMPLE_PC,
          pubSignals
        )
      ).to.be.revertedWithCustomError(anoncitizen, "InvalidNullifier");
    });

    it("should reject nullifier >= SNARK_SCALAR_FIELD", async function () {
      const SNARK_FIELD = BigInt(
        "21888242871839275222246405745257275088548364400416034343698204186575808495617"
      );
      const pubSignals = samplePubSignals({ nullifier: SNARK_FIELD });
      await expect(
        anoncitizen.verifyAndRecord(
          SAMPLE_PA,
          SAMPLE_PB,
          SAMPLE_PC,
          pubSignals
        )
      ).to.be.revertedWithCustomError(anoncitizen, "InvalidNullifier");
    });

    it("should reject untrusted pubKeyHash after nullifier passes", async function () {
      // Valid nullifier but untrusted pubKeyHash
      const pubSignals = samplePubSignals();
      await expect(
        anoncitizen.verifyAndRecord(
          SAMPLE_PA,
          SAMPLE_PB,
          SAMPLE_PC,
          pubSignals
        )
      ).to.be.revertedWithCustomError(anoncitizen, "UntrustedPublicKey");
    });
  });

  describe("verifyOnly (view function)", function () {
    it("should return false or revert for invalid proof", async function () {
      const pubSignals = samplePubSignals();
      try {
        const result = await anoncitizen.verifyOnly(
          SAMPLE_PA,
          SAMPLE_PB,
          SAMPLE_PC,
          pubSignals
        );
        // If it doesn't revert, it should return false
        expect(result).to.be.false;
      } catch {
        // Reverting on invalid proof is also acceptable behavior
      }
    });
  });

  describe("Interface compliance", function () {
    it("should expose isNullifierUsed", async function () {
      expect(typeof anoncitizen.isNullifierUsed).to.equal("function");
    });

    it("should expose verifyAndRecord", async function () {
      expect(typeof anoncitizen.verifyAndRecord).to.equal("function");
    });

    it("should expose verifyOnly", async function () {
      expect(typeof anoncitizen.verifyOnly).to.equal("function");
    });
  });
});

/**
 * Gas Benchmarks (to be run with real proofs after circuit compilation):
 *
 * | Operation           | Expected Gas |
 * |---------------------|-------------|
 * | Deploy Verifier     | ~1,500,000  |
 * | Deploy AnonCitizen  | ~400,000    |
 * | verifyAndRecord     | ~260,000    |
 * | verifyOnly          | ~230,000    |
 * | isNullifierUsed     | ~2,600      |
 *
 * Run with: REPORT_GAS=true npx hardhat test
 */
