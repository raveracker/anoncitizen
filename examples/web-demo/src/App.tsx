import { useState } from "react";
import {
  useAnonCitizen,
  useProofGeneration,
  useVerification,
  QRScanner,
  ProofStatus,
  type AnonCitizenProof,
} from "@anoncitizen/react";

type Step = "scan" | "configure" | "prove" | "verify";

export function App() {
  const { isReady, parseQR } = useAnonCitizen();
  const { status: proofStatus, proof, error: proofError, generate, reset: resetProof } = useProofGeneration();
  const { status: verifyStatus, result: verifyResult, verifyOffChain, reset: resetVerify } = useVerification();

  const [step, setStep] = useState<Step>("scan");
  const [qrData, setQrData] = useState<string | null>(null);
  const [revealAge, setRevealAge] = useState(true);
  const [revealGender, setRevealGender] = useState(false);
  const [revealState, setRevealState] = useState(false);
  const [revealPinCode, setRevealPinCode] = useState(false);
  const [nullifierSeed, setNullifierSeed] = useState("42");

  const handleScan = async (data: string) => {
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
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>AnonCitizen Demo</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Privacy-preserving Aadhaar verification
      </p>

      {!isReady && (
        <div style={{ padding: 16, background: "#FFF3E0", borderRadius: 8, marginBottom: 16 }}>
          Initializing SDK...
        </div>
      )}

      {/* Step 1: Scan QR */}
      {step === "scan" && (
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Step 1: Scan Aadhaar QR Code</h2>
          <QRScanner
            onScan={handleScan}
            onError={(err: Error) => console.error("Scan error:", err)}
            useCamera={true}
          />
        </section>
      )}

      {/* Step 2: Configure reveal fields */}
      {step === "configure" && (
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Step 2: Choose Fields to Reveal</h2>
          <p style={{ color: "#666", marginBottom: 16, fontSize: 14 }}>
            Select which attributes to prove. Unselected fields remain private.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            <label style={labelStyle}>
              <input type="checkbox" checked={revealAge} onChange={(e) => setRevealAge(e.target.checked)} />
              Prove age above 18
            </label>
            <label style={labelStyle}>
              <input type="checkbox" checked={revealGender} onChange={(e) => setRevealGender(e.target.checked)} />
              Reveal gender
            </label>
            <label style={labelStyle}>
              <input type="checkbox" checked={revealState} onChange={(e) => setRevealState(e.target.checked)} />
              Reveal state
            </label>
            <label style={labelStyle}>
              <input type="checkbox" checked={revealPinCode} onChange={(e) => setRevealPinCode(e.target.checked)} />
              Reveal pin code
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Nullifier Seed</label>
            <input
              type="text"
              value={nullifierSeed}
              onChange={(e) => setNullifierSeed(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, width: "100%" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleReset} style={secondaryBtnStyle}>Back</button>
            <button onClick={handleGenerate} style={primaryBtnStyle}>Generate Proof</button>
          </div>
        </section>
      )}

      {/* Step 3: Proof generation */}
      {step === "prove" && (
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Step 3: Generating Proof</h2>
          <ProofStatus status={proofStatus} error={proofError} />
          {proofStatus === "complete" && proof && (
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button onClick={() => handleVerify(proof)} style={primaryBtnStyle}>
                Verify Off-Chain
              </button>
              <button onClick={handleReset} style={secondaryBtnStyle}>Start Over</button>
            </div>
          )}
          {proofStatus === "error" && (
            <button onClick={handleReset} style={{ ...secondaryBtnStyle, marginTop: 16 }}>
              Start Over
            </button>
          )}
        </section>
      )}

      {/* Step 4: Verification */}
      {step === "verify" && (
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Step 4: Verification Result</h2>
          {verifyStatus === "verifying" && <p>Verifying proof...</p>}
          {verifyStatus === "verified" && verifyResult && (
            <div style={{ background: "#E8F5E9", padding: 16, borderRadius: 8 }}>
              <p style={{ color: "#2E7D32", fontWeight: 600, marginBottom: 8 }}>Proof is valid!</p>
              <ul style={{ fontSize: 14, margin: 0, paddingLeft: 20 }}>
                {verifyResult.ageAbove18 !== undefined && (
                  <li>Age above 18: {verifyResult.ageAbove18 ? "Yes" : "No"}</li>
                )}
                {verifyResult.gender !== undefined && <li>Gender: {verifyResult.gender}</li>}
                {verifyResult.state !== undefined && <li>State: {verifyResult.state}</li>}
                {verifyResult.pinCode !== undefined && <li>Pin Code: {verifyResult.pinCode}</li>}
                <li>Nullifier: {verifyResult.nullifier?.toString().slice(0, 16)}...</li>
                <li>Timestamp: {new Date(Number(verifyResult.timestamp) * 1000).toLocaleString()}</li>
              </ul>
            </div>
          )}
          {verifyStatus === "invalid" && (
            <div style={{ background: "#FFEBEE", padding: 16, borderRadius: 8 }}>
              <p style={{ color: "#C62828", fontWeight: 600 }}>Proof is invalid.</p>
            </div>
          )}
          <button onClick={handleReset} style={{ ...secondaryBtnStyle, marginTop: 16 }}>
            Start Over
          </button>
        </section>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  cursor: "pointer",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "10px 20px",
  background: "#1976D2",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "10px 20px",
  background: "#f5f5f5",
  color: "#333",
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: 14,
  cursor: "pointer",
};
