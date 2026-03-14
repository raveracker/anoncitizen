import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AnonCitizenProvider } from "@anoncitizen/react";
import { App } from "./App.js";

const config = {
  wasmUrl: "/circuit.wasm",
  zkeyUrl: "/circuit.zkey",
  verificationKeyUrl: "/verification_key.json",
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AnonCitizenProvider config={config}>
      <App />
    </AnonCitizenProvider>
  </StrictMode>
);
