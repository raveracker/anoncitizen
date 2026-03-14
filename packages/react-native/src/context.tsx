/**
 * @module @anoncitizen/react-native/context
 * React context for the AnonCitizen SDK instance (React Native).
 */

import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  AnonCitizen,
  type AnonCitizenConfig,
  type RSAPublicKey,
} from "@anoncitizen/core";

export interface AnonCitizenContextValue {
  /** The SDK instance (null while initializing) */
  sdk: AnonCitizen | null;
  /** Whether the SDK is ready (keys loaded, artifacts available) */
  isReady: boolean;
  /** Initialization error, if any */
  error: Error | null;
}

const AnonCitizenContext = createContext<AnonCitizenContextValue | null>(null);

export interface AnonCitizenProviderProps {
  /** SDK configuration (WASM/zkey URLs, verification key) */
  config: AnonCitizenConfig;
  /** UIDAI RSA public key (PEM string, DER bytes, or pre-parsed) */
  publicKey?: Uint8Array | string | RSAPublicKey;
  children: ReactNode;
}

/**
 * Provides the AnonCitizen SDK instance to all child components.
 *
 * @example
 * ```tsx
 * <AnonCitizenProvider
 *   config={{ wasmUrl: "/circuit.wasm", zkeyUrl: "/circuit.zkey" }}
 *   publicKey={uidaiCertPem}
 * >
 *   <App />
 * </AnonCitizenProvider>
 * ```
 */
export function AnonCitizenProvider({
  config,
  publicKey,
  children,
}: AnonCitizenProviderProps) {
  const sdkRef = useRef<AnonCitizen | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const sdk = new AnonCitizen(config);
      if (publicKey) {
        sdk.setPublicKey(publicKey);
      }
      sdkRef.current = sdk;
      setIsReady(true);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to initialize SDK")
      );
      setIsReady(false);
    }
  }, [config, publicKey]);

  return (
    <AnonCitizenContext.Provider
      value={{ sdk: sdkRef.current, isReady, error }}
    >
      {children}
    </AnonCitizenContext.Provider>
  );
}

/**
 * Access the AnonCitizen SDK context.
 * Must be used within an `<AnonCitizenProvider>`.
 */
export function useAnonCitizenContext(): AnonCitizenContextValue {
  const ctx = useContext(AnonCitizenContext);
  if (!ctx) {
    throw new Error(
      "useAnonCitizenContext must be used within <AnonCitizenProvider>"
    );
  }
  return ctx;
}
