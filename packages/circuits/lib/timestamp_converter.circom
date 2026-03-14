pragma circom 2.1.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "./field_extractor.circom";

/// @title TimestampParser
/// @notice Parses a numeric timestamp from Aadhaar QR signed data
/// @param nDigits Number of digits in the timestamp string
/// @dev The Aadhaar QR stores timestamps as numeric strings.
///      Format varies by QR version:
///        V2: typically a packed integer representing milliseconds or seconds since epoch
///        or a date string like "YYYYMMDDHHMMSS"
///      This template handles the numeric string case.
///      Constraint cost: O(nDigits) for digit validation + arithmetic
template TimestampParser(nDigits) {
    signal input digits[nDigits]; // ASCII digit bytes
    signal output value;          // parsed numeric value

    signal digitValues[nDigits];
    component rangeCheck[nDigits];

    for (var i = 0; i < nDigits; i++) {
        digitValues[i] <== digits[i] - 48; // ASCII '0' = 48

        rangeCheck[i] = LessThan(8);
        rangeCheck[i].in[0] <== digitValues[i];
        rangeCheck[i].in[1] <== 10;
        rangeCheck[i].out === 1;
    }

    signal partial[nDigits + 1];
    partial[0] <== 0;
    for (var i = 0; i < nDigits; i++) {
        partial[i + 1] <== partial[i] * 10 + digitValues[i];
    }
    value <== partial[nDigits];
}

/// @title DateToUnixUTC
/// @notice Converts a date (YYYY, MM, DD, HH, MM, SS) to approximate UNIX UTC timestamp
/// @dev Simplified calculation that doesn't account for leap years precisely.
///      For Aadhaar verification, approximate accuracy is sufficient since the
///      timestamp is used for liveness/freshness checks, not exact time matching.
///
///      Constraint cost: ~50 (basic arithmetic)
template DateToUnixUTC() {
    signal input year;
    signal input month;
    signal input day;
    signal input hour;
    signal input minute;
    signal input second;
    signal output unixTimestamp;

    // Days per month (non-leap year): 31,28,31,30,31,30,31,31,30,31,30,31
    // For simplicity, use average: 30.44 days/month
    // More precise: count days from epoch

    // Days from 1970-01-01 to YYYY-MM-DD (simplified):
    // daysFromEpoch ≈ (year - 1970) * 365 + leapDays + monthDays + day - 1

    // Leap days since 1970 (approximate): floor((year - 1969) / 4)
    signal yearsSinceEpoch;
    yearsSinceEpoch <== year - 1970;

    // Approximate leap days (ignoring century rules — sufficient for 2000-2100)
    signal leapYears;
    // Hint for the quotient
    leapYears <-- (year - 1969) \ 4;
    // Constrain: leapYears * 4 <= (year - 1969) < (leapYears + 1) * 4
    signal yearOffset;
    yearOffset <== year - 1969;
    signal lowerBound;
    lowerBound <== leapYears * 4;
    // yearOffset - lowerBound must be in [0, 3]
    signal remainder;
    remainder <== yearOffset - lowerBound;
    // Range check: remainder < 4 (i.e., remainder is 0, 1, 2, or 3)
    component remainderBits = Num2Bits(2); // 2 bits can represent 0-3
    remainderBits.in <== remainder;

    // Cumulative days before each month (non-leap year)
    // Jan=0, Feb=31, Mar=59, Apr=90, May=120, Jun=151,
    // Jul=181, Aug=212, Sep=243, Oct=273, Nov=304, Dec=334
    var monthDays[12] = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

    // Select cumulative days for the given month
    signal monthCumDays;
    signal monthSelect[12];
    component monthEq[12];

    for (var i = 0; i < 12; i++) {
        monthEq[i] = IsEqual();
        monthEq[i].in[0] <== month;
        monthEq[i].in[1] <== i + 1;
        monthSelect[i] <== monthEq[i].out * monthDays[i];
    }

    signal monthPartial[13];
    monthPartial[0] <== 0;
    for (var i = 0; i < 12; i++) {
        monthPartial[i + 1] <== monthPartial[i] + monthSelect[i];
    }
    monthCumDays <== monthPartial[12];

    // Total days from epoch
    signal totalDays;
    totalDays <== yearsSinceEpoch * 365 + leapYears + monthCumDays + day - 1;

    // Convert to seconds and add time components
    signal daySeconds;
    daySeconds <== totalDays * 86400;

    signal hourSeconds;
    hourSeconds <== hour * 3600;

    signal minuteSeconds;
    minuteSeconds <== minute * 60;

    unixTimestamp <== daySeconds + hourSeconds + minuteSeconds + second;
}

/// @title ISTtoUTC
/// @notice Converts an IST (Indian Standard Time) timestamp to UNIX UTC
/// @dev IST = UTC + 5 hours 30 minutes = UTC + 19800 seconds
///      Simply subtracts the offset.
///      Constraint cost: 1 (single subtraction)
template ISTtoUTC() {
    signal input istTimestamp; // UNIX timestamp in IST
    signal output utcTimestamp;

    // IST offset: 5 hours 30 minutes = 19800 seconds
    utcTimestamp <== istTimestamp - 19800;
}

/// @title TimestampExtractor
/// @notice Full timestamp pipeline: extract from signed data, parse, convert IST→UTC
/// @param maxDataBytes Maximum signed data byte length
/// @param timestampDigits Number of digits in the timestamp field
/// @dev For Aadhaar QR V2, the timestamp is typically embedded in the reference ID
///      field or as a separate numeric field. The exact format depends on the QR version.
///
///      The prover provides the timestamp byte position as a hint.
///      Constraint cost: ~100 (parsing + conversion)
template TimestampExtractor(maxDataBytes, timestampDigits) {
    signal input data[maxDataBytes];
    signal input timestampStart; // byte offset of timestamp in signed data
    signal output utcTimestamp;

    // Extract timestamp digits from data using constrained ByteSelector
    signal tsDigits[timestampDigits];
    component tsSelectors[timestampDigits];

    for (var i = 0; i < timestampDigits; i++) {
        tsSelectors[i] = ByteSelector(maxDataBytes);
        for (var j = 0; j < maxDataBytes; j++) {
            tsSelectors[i].data[j] <== data[j];
        }
        tsSelectors[i].index <== timestampStart + i;
        tsDigits[i] <== tsSelectors[i].out;
    }

    // Parse as numeric value
    component parser = TimestampParser(timestampDigits);
    for (var i = 0; i < timestampDigits; i++) {
        parser.digits[i] <== tsDigits[i];
    }

    // Convert IST to UTC
    component converter = ISTtoUTC();
    converter.istTimestamp <== parser.value;
    utcTimestamp <== converter.utcTimestamp;
}
