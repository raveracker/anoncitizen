import { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
} from "react-native";
import {
  AnonCitizenProvider,
  useAnonCitizen,
  useProofGeneration,
  useVerification,
  CameraQRScanner,
  ImageQRScanner,
  ProofStatus,
  type AnonCitizenProof,
} from "@anoncitizen/react-native";

const config = {
  wasmUrl: "https://example.com/circuit.wasm",
  zkeyUrl: "https://example.com/circuit.zkey",
  verificationKeyUrl: "https://example.com/verification_key.json",
};

export default function App() {
  return (
    <AnonCitizenProvider config={config}>
      <Demo />
    </AnonCitizenProvider>
  );
}

type Step = "scan" | "configure" | "prove" | "verify";

function Demo() {
  const { isReady } = useAnonCitizen();
  const {
    status: proofStatus,
    proof,
    error: proofError,
    generate,
    reset: resetProof,
  } = useProofGeneration();
  const {
    status: verifyStatus,
    result: verifyResult,
    verifyOffChain,
    reset: resetVerify,
  } = useVerification();

  const [step, setStep] = useState<Step>("scan");
  const [qrData, setQrData] = useState<string | null>(null);
  const [useCamera, setUseCamera] = useState(true);
  const [revealAge, setRevealAge] = useState(true);
  const [revealGender, setRevealGender] = useState(false);
  const [revealState, setRevealState] = useState(false);
  const [revealPinCode, setRevealPinCode] = useState(false);
  const [nullifierSeed, setNullifierSeed] = useState("42");

  const handleScan = (data: string) => {
    setQrData(data);
    setStep("configure");
  };

  const handleGenerate = async () => {
    if (!qrData) return;
    setStep("prove");
    await generate({
      qrData,
      nullifierSeed: BigInt(nullifierSeed),
      revealAgeAbove18: revealAge,
      revealGender,
      revealState,
      revealPinCode,
    });
  };

  const handleVerify = async (p: AnonCitizenProof) => {
    setStep("verify");
    await verifyOffChain(p);
  };

  const handleReset = () => {
    setStep("scan");
    setQrData(null);
    resetProof();
    resetVerify();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>AnonCitizen</Text>
        <Text style={styles.subtitle}>Privacy-preserving Aadhaar verification</Text>

        {!isReady && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Initializing SDK...</Text>
          </View>
        )}

        {/* Step 1: Scan */}
        {step === "scan" && (
          <View style={styles.section}>
            <Text style={styles.heading}>Step 1: Scan QR Code</Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Use Camera</Text>
              <Switch value={useCamera} onValueChange={setUseCamera} />
            </View>

            {useCamera ? (
              <CameraQRScanner
                onScan={handleScan}
                onError={(err: Error) => console.error("Scan error:", err)}
                facing="back"
                style={styles.scanner}
              />
            ) : (
              <ImageQRScanner
                onScan={handleScan}
                onError={(err: Error) => console.error("Pick error:", err)}
                buttonLabel="Pick QR Image from Gallery"
              />
            )}
          </View>
        )}

        {/* Step 2: Configure */}
        {step === "configure" && (
          <View style={styles.section}>
            <Text style={styles.heading}>Step 2: Choose Fields</Text>
            <Text style={styles.hint}>Select attributes to reveal in the proof.</Text>

            <ToggleRow label="Prove age above 18" value={revealAge} onValueChange={setRevealAge} />
            <ToggleRow label="Reveal gender" value={revealGender} onValueChange={setRevealGender} />
            <ToggleRow label="Reveal state" value={revealState} onValueChange={setRevealState} />
            <ToggleRow label="Reveal pin code" value={revealPinCode} onValueChange={setRevealPinCode} />

            <Text style={[styles.toggleLabel, { marginTop: 16, marginBottom: 4 }]}>
              Nullifier Seed
            </Text>
            <TextInput
              style={styles.input}
              value={nullifierSeed}
              onChangeText={setNullifierSeed}
              keyboardType="numeric"
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleGenerate}>
                <Text style={styles.primaryBtnText}>Generate Proof</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Prove */}
        {step === "prove" && (
          <View style={styles.section}>
            <Text style={styles.heading}>Step 3: Generating Proof</Text>
            <ProofStatus status={proofStatus} error={proofError} />

            {proofStatus === "complete" && proof && (
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => handleVerify(proof)}>
                  <Text style={styles.primaryBtnText}>Verify Off-Chain</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset}>
                  <Text style={styles.secondaryBtnText}>Start Over</Text>
                </TouchableOpacity>
              </View>
            )}

            {proofStatus === "error" && (
              <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 16 }]} onPress={handleReset}>
                <Text style={styles.secondaryBtnText}>Start Over</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Step 4: Verify */}
        {step === "verify" && (
          <View style={styles.section}>
            <Text style={styles.heading}>Step 4: Verification</Text>

            {verifyStatus === "verifying" && <Text style={styles.hint}>Verifying proof...</Text>}

            {verifyStatus === "verified" && verifyResult && (
              <View style={styles.successBox}>
                <Text style={styles.successTitle}>Proof is valid!</Text>
                {verifyResult.ageAbove18 !== undefined && (
                  <Text style={styles.resultItem}>Age above 18: {verifyResult.ageAbove18 ? "Yes" : "No"}</Text>
                )}
                {verifyResult.gender !== undefined && (
                  <Text style={styles.resultItem}>Gender: {verifyResult.gender}</Text>
                )}
                {verifyResult.state !== undefined && (
                  <Text style={styles.resultItem}>State: {verifyResult.state}</Text>
                )}
                {verifyResult.pinCode !== undefined && (
                  <Text style={styles.resultItem}>Pin Code: {verifyResult.pinCode}</Text>
                )}
                <Text style={styles.resultItem}>
                  Nullifier: {verifyResult.nullifier?.toString().slice(0, 16)}...
                </Text>
              </View>
            )}

            {verifyStatus === "invalid" && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>Proof is invalid.</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 16 }]} onPress={handleReset}>
              <Text style={styles.secondaryBtnText}>Start Over</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 24 },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  banner: { backgroundColor: "#FFF3E0", padding: 12, borderRadius: 8, marginBottom: 16 },
  bannerText: { fontSize: 14, color: "#E65100" },
  section: { marginBottom: 32 },
  heading: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  hint: { fontSize: 14, color: "#666", marginBottom: 16 },
  scanner: { borderRadius: 12, overflow: "hidden" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleLabel: { fontSize: 15 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#1976D2",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  secondaryBtnText: { color: "#333", fontSize: 15 },
  successBox: { backgroundColor: "#E8F5E9", padding: 16, borderRadius: 8 },
  successTitle: { color: "#2E7D32", fontWeight: "600", fontSize: 16, marginBottom: 8 },
  resultItem: { fontSize: 14, color: "#333", marginBottom: 4 },
  errorBox: { backgroundColor: "#FFEBEE", padding: 16, borderRadius: 8 },
  errorBoxText: { color: "#C62828", fontWeight: "600" },
});
