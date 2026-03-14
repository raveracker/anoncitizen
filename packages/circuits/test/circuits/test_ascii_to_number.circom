pragma circom 2.1.0;

include "../../lib/field_extractor.circom";

// Test with 4-digit numbers (e.g., year) and 6-digit numbers (e.g., pincode)
// Using 6 digits for the test to cover both cases
component main = AsciiDigitsToNumber(6);
