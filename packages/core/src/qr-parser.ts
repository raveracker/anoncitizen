/**
 * @module @anoncitizen/core/qr-parser
 * Parses Aadhaar secure QR code data into structured payload.
 *
 * QR encoding pipeline:
 *   QR image → decimal string → BigInt → hex → bytes → zlib decompress → payload
 *
 * Payload layout (per aadhaar_qr_spec.md):
 *   [17 0xFF-delimited text fields][email/mobile hashes][photo bytes][RSA signature]
 */

import pako from "pako";
import type { AadhaarQRPayload } from "./types.js";

const DELIMITER = 0xff;
const SIGNATURE_LENGTH = 256; // RSA-2048 = 256 bytes
const FIELD_COUNT = 17;

// JPEG 2000 codestream marker
const JP2_MARKER = new Uint8Array([0xff, 0x4f, 0xff, 0x51]);
// JP2 file format marker
const JP2_FILE_MARKER = new Uint8Array([
  0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
]);

/**
 * Parse raw QR code data into an AadhaarQRPayload.
 *
 * @param qrData - Either raw image bytes (requires external QR decoder)
 *                 or the decoded QR string (decimal digit string).
 * @returns Parsed Aadhaar QR payload with all fields extracted.
 * @throws If the QR data cannot be parsed or decompressed.
 */
export async function parseQRCode(
  qrData: Uint8Array | string
): Promise<AadhaarQRPayload> {
  // If qrData is a string, it's the decimal digit string from the QR
  // If it's Uint8Array, assume it's already decompressed or needs decompression
  let decompressed: Uint8Array;

  if (typeof qrData === "string") {
    decompressed = decodeQRString(qrData);
  } else {
    decompressed = tryDecompress(qrData);
  }

  return parseDecompressedPayload(decompressed);
}

/** Maximum expected length of the QR decimal string */
const MAX_QR_STRING_LENGTH = 15_000;

/**
 * Decode the QR decimal string to decompressed bytes.
 * QR encodes a BigInt as a decimal string → convert to bytes → decompress.
 */
function decodeQRString(decimalString: string): Uint8Array {
  // Validate input: must contain only digits and be within expected size
  if (!/^\d+$/.test(decimalString)) {
    throw new Error(
      "Invalid QR data: expected a decimal digit string"
    );
  }
  if (decimalString.length > MAX_QR_STRING_LENGTH) {
    throw new Error(
      `Invalid QR data: string too long (${decimalString.length} chars, max ${MAX_QR_STRING_LENGTH})`
    );
  }

  // Convert decimal string to BigInt
  const bigInt = BigInt(decimalString);

  // Convert BigInt to hex, then to bytes
  let hex = bigInt.toString(16);
  if (hex.length % 2 !== 0) {
    hex = "0" + hex;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }

  return tryDecompress(bytes);
}

/**
 * Try multiple decompression methods (inflate, inflateRaw, unzip).
 */
function tryDecompress(data: Uint8Array): Uint8Array {
  // If already decompressed (starts with a valid version byte), return as-is
  if (data.length > 256 && isValidPayload(data)) {
    return data;
  }

  // Try standard inflate
  try {
    return pako.inflate(data);
  } catch {
    // Try raw inflate
    try {
      return pako.inflateRaw(data);
    } catch {
      // Try unzip
      try {
        return pako.ungzip(data);
      } catch {
        throw new Error(
          "Failed to decompress QR data. Tried inflate, inflateRaw, and ungzip."
        );
      }
    }
  }
}

/**
 * Check if a byte array looks like a valid decompressed Aadhaar QR payload.
 */
function isValidPayload(data: Uint8Array): boolean {
  // Must have at least signature length + some data
  if (data.length < SIGNATURE_LENGTH + 50) return false;

  // Must contain at least FIELD_COUNT delimiters
  let delimCount = 0;
  for (let i = 0; i < data.length - SIGNATURE_LENGTH; i++) {
    if (data[i] === DELIMITER) delimCount++;
    if (delimCount >= FIELD_COUNT) return true;
  }
  return false;
}

/**
 * Parse the decompressed payload into structured fields.
 */
function parseDecompressedPayload(data: Uint8Array): AadhaarQRPayload {
  if (data.length < SIGNATURE_LENGTH + 50) {
    throw new Error(
      `Payload too short: ${data.length} bytes (minimum ~306 expected)`
    );
  }

  // Extract signature (last 256 bytes)
  const signedData = data.slice(0, data.length - SIGNATURE_LENGTH);
  const signature = data.slice(data.length - SIGNATURE_LENGTH);

  // Parse 0xFF-delimited text fields
  const fields: string[] = [];
  const delimiterPositions: number[] = [];
  let fieldStart = 0;

  for (let i = 0; i < signedData.length && fields.length < FIELD_COUNT; i++) {
    if (signedData[i] === DELIMITER) {
      const fieldBytes = signedData.slice(fieldStart, i);
      fields.push(new TextDecoder("latin1").decode(fieldBytes));
      delimiterPositions.push(i);
      fieldStart = i + 1;
    }
  }

  if (fields.length < FIELD_COUNT) {
    throw new Error(
      `Expected ${FIELD_COUNT} fields, found ${fields.length}. Data may be corrupt.`
    );
  }

  // After the last delimiter: email/mobile hash bytes, then photo
  const afterFieldsOffset = fieldStart;
  const emailMobileIndicator = parseInt(fields[1], 10) || 0;

  // Determine hash byte count
  let hashByteCount = 0;
  if (emailMobileIndicator === 1 || emailMobileIndicator === 2) {
    hashByteCount = 32;
  } else if (emailMobileIndicator === 3) {
    hashByteCount = 64;
  }

  // Extract email/mobile hashes
  let emailHash: Uint8Array | undefined;
  let mobileHash: Uint8Array | undefined;
  const hashStart = afterFieldsOffset;

  if (emailMobileIndicator === 3) {
    emailHash = signedData.slice(hashStart, hashStart + 32);
    mobileHash = signedData.slice(hashStart + 32, hashStart + 64);
  } else if (emailMobileIndicator === 1) {
    emailHash = signedData.slice(hashStart, hashStart + 32);
  } else if (emailMobileIndicator === 2) {
    mobileHash = signedData.slice(hashStart, hashStart + 32);
  }

  // Find photo start (after hash bytes)
  const photoSearchStart = afterFieldsOffset + hashByteCount;
  const photoStart = findPhotoStart(signedData, photoSearchStart);
  const photo = signedData.slice(photoStart);

  return {
    version: fields[0],
    emailMobileIndicator,
    referenceId: fields[2],
    name: fields[3],
    dob: fields[4],
    gender: fields[5],
    careOf: fields[6],
    district: fields[7],
    landmark: fields[8],
    house: fields[9],
    location: fields[10],
    pinCode: fields[11],
    postOffice: fields[12],
    state: fields[13],
    street: fields[14],
    subDistrict: fields[15],
    vtc: fields[16],
    signedData,
    signature,
    photo,
    emailHash,
    mobileHash,
    delimiterPositions,
    photoStart,
  };
}

/**
 * Find the start of the photo data by looking for JPEG 2000 markers.
 */
function findPhotoStart(data: Uint8Array, searchFrom: number): number {
  // Look for JPEG 2000 codestream marker (FF 4F FF 51)
  for (let i = searchFrom; i < data.length - 4; i++) {
    if (
      data[i] === JP2_MARKER[0] &&
      data[i + 1] === JP2_MARKER[1] &&
      data[i + 2] === JP2_MARKER[2] &&
      data[i + 3] === JP2_MARKER[3]
    ) {
      return i;
    }
  }

  // Look for JP2 file format marker
  for (let i = searchFrom; i < data.length - JP2_FILE_MARKER.length; i++) {
    let match = true;
    for (let j = 0; j < JP2_FILE_MARKER.length; j++) {
      if (data[i + j] !== JP2_FILE_MARKER[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }

  // Fallback: assume photo starts right after hash bytes
  return searchFrom;
}
