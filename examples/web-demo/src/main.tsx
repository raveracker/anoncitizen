import { Buffer } from "buffer";
(globalThis as unknown as Record<string, unknown>).Buffer = Buffer;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AnonCitizenProvider } from "@anoncitizen/react";
import { App } from "./App.js";

const config = {
  wasmUrl: import.meta.env.VITE_CIRCUIT_WASM_URL || "/circuit.wasm",
  zkeyUrl: import.meta.env.VITE_CIRCUIT_ZKEY_URL || "/circuit.zkey",
  verificationKeyUrl: import.meta.env.VITE_VERIFICATION_KEY_URL || "/verification_key.json",
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AnonCitizenProvider config={config}>
      <App />
    </AnonCitizenProvider>
  </StrictMode>
);
