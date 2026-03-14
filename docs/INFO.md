# AnonCitizen

## Overview

AnonCitizen is a privacy-preserving protocol for proving ownership of an Aadhaar identity document without exposing unnecessary personal information. It enables users to generate a zero-knowledge proof (ZKP) of identity and disclose only the attributes required by an application.

Developers can integrate the AnonCitizen SDK into their applications to verify user identity while minimizing data exposure. The generated proof can be verified both off-chain and on EVM-compatible blockchains, making AnonCitizen suitable for privacy-focused on-chain and off-chain applications.

## Product Requirements

AnonCitizen should support:

- Privacy-preserving proof of Aadhaar identity ownership
- Selective disclosure of identity attributes
- Off-chain verification of generated proofs
- On-chain verification on EVM-based networks
- Optional signal binding alongside the proof

## Core Features

With AnonCitizen, users and developers should be able to:

- Generate a ZKP for Aadhaar card verification
- Verify the proof on-chain or off-chain
- Send a signal alongside the ZKP

## Packages

The project will include the following packages:

- `@anoncitizen/core`
- `@anoncitizen/react` (supports the latest version of React)
- `@anoncitizen/contracts`
- `@anoncitizen/react-native` (supports the latest version of Expo)

## How It Works

### Introduction

AnonCitizen is a zero-knowledge protocol that allows Aadhaar holders to prove possession of a government-issued Aadhaar document while preserving anonymity. It uses the secure QR code present on e-Aadhaar and printed Aadhaar letters, ensuring that the Aadhaar number and other personal information remain confidential unless explicitly disclosed.

### Workflow

#### RSA and Document Verification

At the core of the verification flow is RSA, a public-key cryptographic signature algorithm. The Aadhaar document is signed using a private key, and the corresponding public key is used to verify that signature.

In AnonCitizen, this verification is performed inside a circuit and results in a zk-SNARK proof. This allows the protocol to prove that the document is authentic without revealing the full underlying identity data.

## Proof Generation Flow

### 1. Extract and Process Data From the QR Code

The proof generation process begins by reading the Aadhaar secure QR code from an image or by scanning it from a camera in mobile environments.

This step includes:

- Extracting the signed data bytes
- Extracting the RSA signature bytes
- Verifying the signature outside the circuit as an initial validity check
- Fetching the official UIDAI public key to use as a circuit input
- Hashing the optional signal

#### Required Inputs

From the QR code:

- Bytes of the signed data
- Bytes of the RSA signature

External inputs:

- The Indian government's RSA public key
- A signal
- A nullifier seed

### 2. Generate the AnonCitizen Proof

The proof is generated using Circom circuits that validate the authenticity of the Aadhaar document while preserving privacy.

This step includes the following operations:

#### Apply SHA-256 to the Signed Data

The circuit verifies the SHA-256 hash of the signed data. This ensures the integrity of the document content, since the RSA signature is applied over this hash.

#### Verify the RSA Signature

After validating the hash, the circuit verifies the RSA signature against the UIDAI public key. This confirms that the document was signed by the correct authority and has not been tampered with.

#### Extract Photo Bytes

The photo bytes are extracted from the signed data and used as part of the nullifier generation process.

#### Extract Identity Fields When Requested

If the application requests selective disclosure, the circuit can reveal specific identity properties. Supported fields are:

- Age greater than 18
- Gender
- State
- Pincode

By default, the prover reveals none of these fields.

#### Compute Nullifiers

Nullifiers are unique identifiers derived from private identity data. They help prevent duplicate proofs or replay-like behavior without revealing the underlying personal information.

#### Convert Timestamp From IST to UNIX UTC

The timestamp embedded in the Aadhaar data is converted from IST to UNIX UTC format. This standardization supports consistent verification across systems and environments.

#### Bind the Signal Hash

The final step applies constraints to the `signalHash` as part of proof generation. This allows the user to commit to a specific signal while generating the proof.

This parameter is optional and defaults to `1` in the SDK. It is primarily useful for:

- Preventing on-chain front-running
- Supporting ERC-4337 style integrations

## Reference Image

See `docs/proving_flow.png` for the circuit architecture diagram showing inputs, circuit operations, and outputs.
