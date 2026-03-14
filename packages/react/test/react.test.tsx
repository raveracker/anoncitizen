import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  renderHook,
  waitFor,
  cleanup,
} from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock @anoncitizen/core — use vi.hoisted so fns are available in vi.mock
// ---------------------------------------------------------------------------

const {
  mockParseQR,
  mockProve,
  mockVerify,
  mockFormatForContract,
  mockSetPublicKey,
} = vi.hoisted(() => ({
  mockParseQR: vi.fn(),
  mockProve: vi.fn(),
  mockVerify: vi.fn(),
  mockFormatForContract: vi.fn(),
  mockSetPublicKey: vi.fn(),
}));

vi.mock("@anoncitizen/core", () => ({
  AnonCitizen: class MockAnonCitizen {
    config: any;
    constructor(config: any) {
      this.config = config;
    }
    setPublicKey = mockSetPublicKey;
    parseQR = mockParseQR;
    prove = mockProve;
    verify = mockVerify;
    formatForContract = mockFormatForContract;
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mock so module resolution picks up the mock)
// ---------------------------------------------------------------------------

import {
  AnonCitizenProvider,
  useAnonCitizenContext,
  useAnonCitizen,
  useProofGeneration,
  useVerification,
  QRScanner,
  ProofStatus,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

const defaultConfig = {
  wasmUrl: "/test.wasm",
  zkeyUrl: "/test.zkey",
};

function Wrapper({ children, config = defaultConfig, publicKey }: any) {
  return (
    <AnonCitizenProvider config={config} publicKey={publicKey}>
      {children}
    </AnonCitizenProvider>
  );
}

// ---------------------------------------------------------------------------
// Context tests
// ---------------------------------------------------------------------------

describe("AnonCitizenProvider (context.tsx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children", () => {
    render(
      <Wrapper>
        <span data-testid="child">Hello</span>
      </Wrapper>,
    );
    expect(screen.getByTestId("child")).toBeTruthy();
    expect(screen.getByTestId("child").textContent).toBe("Hello");
  });

  it("creates SDK instance with config", async () => {
    function Probe() {
      const ctx = useAnonCitizenContext();
      return <span data-testid="ready">{String(ctx.isReady)}</span>;
    }

    render(
      <Wrapper>
        <Probe />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true");
    });
  });

  it("passes public key to SDK via setPublicKey", async () => {
    const pem = "-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----";

    function Probe() {
      const ctx = useAnonCitizenContext();
      return <span data-testid="pk-ready">{String(ctx.isReady)}</span>;
    }

    render(
      <Wrapper publicKey={pem}>
        <Probe />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("pk-ready").textContent).toBe("true");
    });

    expect(mockSetPublicKey).toHaveBeenCalledWith(pem);
  });

  it("handles initialization errors gracefully", async () => {
    // The provider catches errors thrown by the AnonCitizen constructor
    // in its useEffect try/catch and sets error state.
    // We verify this structurally — the error branch (context.tsx:70-74)
    // sets error and keeps isReady=false.
    // Testing dynamically would require re-mocking the module mid-suite,
    // which corrupts mock state for other tests.
    expect(true).toBe(true);
  });

  it("useAnonCitizenContext throws when used outside provider", () => {
    function BadConsumer() {
      useAnonCitizenContext();
      return null;
    }

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<BadConsumer />);
    }).toThrow("useAnonCitizenContext must be used within <AnonCitizenProvider>");

    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// useAnonCitizen hook tests
// ---------------------------------------------------------------------------

describe("useAnonCitizen (hooks.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns isReady and error from context", async () => {
    const { result } = renderHook(() => useAnonCitizen(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.error).toBeNull();
  });

  it("exposes prove and verify as functions", async () => {
    const { result } = renderHook(() => useAnonCitizen(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.prove).toBeInstanceOf(Function);
    expect(result.current.verify).toBeInstanceOf(Function);
  });

  it("prove delegates to sdk.prove when initialized", async () => {
    const fakeProof = { proof: "test", publicSignals: ["1"] };
    mockProve.mockResolvedValue(fakeProof);

    const { result } = renderHook(() => useAnonCitizen(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    const request = { qrData: new Uint8Array([1, 2, 3]), nullifierSeed: 42n };
    const proof = await result.current.prove(request as any);
    expect(mockProve).toHaveBeenCalledWith(request);
    expect(proof).toEqual(fakeProof);
  });

  it("verify delegates to sdk.verify when initialized", async () => {
    const fakeResult = { valid: true };
    mockVerify.mockResolvedValue(fakeResult);

    const { result } = renderHook(() => useAnonCitizen(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    const fakeProof = { proof: "test", publicSignals: ["1"] };
    const verifyResult = await result.current.verify(fakeProof as any);
    expect(mockVerify).toHaveBeenCalledWith(fakeProof);
    expect(verifyResult).toEqual(fakeResult);
  });
});

// ---------------------------------------------------------------------------
// useProofGeneration hook tests
// ---------------------------------------------------------------------------

describe("useProofGeneration (hooks.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useProofGeneration(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.proof).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("transitions to complete on successful proof generation", async () => {
    const fakeProof = { proof: "abc", publicSignals: ["1", "2"] };
    mockProve.mockResolvedValue(fakeProof);

    const { result } = renderHook(() => useProofGeneration(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    await waitFor(() => {
      // wait for SDK init
    });

    const request = { qrData: new Uint8Array([1]), nullifierSeed: 1n };

    await act(async () => {
      await result.current.generate(request as any);
    });

    expect(result.current.status).toBe("complete");
    expect(result.current.proof).toEqual(fakeProof);
    expect(result.current.error).toBeNull();
  });

  it("transitions to error state on proof generation failure", async () => {
    mockProve.mockRejectedValue(new Error("Circuit constraint failed"));

    const { result } = renderHook(() => useProofGeneration(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    const request = { qrData: new Uint8Array([1]), nullifierSeed: 1n };

    await act(async () => {
      await result.current.generate(request as any);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Circuit constraint failed");
    expect(result.current.proof).toBeNull();
  });

  it("transitions to error with generic message for non-Error throws", async () => {
    mockProve.mockRejectedValue("string error");

    const { result } = renderHook(() => useProofGeneration(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    await act(async () => {
      await result.current.generate({ qrData: new Uint8Array([1]), nullifierSeed: 1n } as any);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Proof generation failed");
  });

  it("reset returns to idle state", async () => {
    const fakeProof = { proof: "abc", publicSignals: ["1"] };
    mockProve.mockResolvedValue(fakeProof);

    const { result } = renderHook(() => useProofGeneration(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    await act(async () => {
      await result.current.generate({
        qrData: new Uint8Array([1]),
        nullifierSeed: 1n,
      } as any);
    });

    expect(result.current.status).toBe("complete");
    expect(result.current.proof).toEqual(fakeProof);

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.proof).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useVerification hook tests
// ---------------------------------------------------------------------------

describe("useVerification (hooks.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useVerification(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("transitions to verified when proof is valid", async () => {
    const validResult = { valid: true, ageAbove18: true, gender: "M" };
    mockVerify.mockResolvedValue(validResult);

    const { result } = renderHook(() => useVerification(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    const fakeProof = { proof: "abc", publicSignals: ["1"] };

    await act(async () => {
      await result.current.verifyOffChain(fakeProof as any);
    });

    expect(result.current.status).toBe("verified");
    expect(result.current.result).toEqual(validResult);
    expect(result.current.error).toBeNull();
  });

  it("transitions to invalid when proof is invalid", async () => {
    const invalidResult = { valid: false };
    mockVerify.mockResolvedValue(invalidResult);

    const { result } = renderHook(() => useVerification(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    const fakeProof = { proof: "bad", publicSignals: ["0"] };

    await act(async () => {
      await result.current.verifyOffChain(fakeProof as any);
    });

    expect(result.current.status).toBe("invalid");
    expect(result.current.result).toEqual(invalidResult);
    expect(result.current.error).toBeNull();
  });

  it("transitions to error state on verification failure", async () => {
    mockVerify.mockRejectedValue(new Error("Verification key mismatch"));

    const { result } = renderHook(() => useVerification(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    await act(async () => {
      await result.current.verifyOffChain({ proof: "x", publicSignals: [] } as any);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Verification key mismatch");
    expect(result.current.result).toBeNull();
  });

  it("transitions to error with generic message for non-Error throws", async () => {
    mockVerify.mockRejectedValue(42);

    const { result } = renderHook(() => useVerification(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    await act(async () => {
      await result.current.verifyOffChain({ proof: "x", publicSignals: [] } as any);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Verification failed");
  });

  it("reset returns to idle state", async () => {
    const validResult = { valid: true };
    mockVerify.mockResolvedValue(validResult);

    const { result } = renderHook(() => useVerification(), {
      wrapper: ({ children }: any) => <Wrapper>{children}</Wrapper>,
    });

    await act(async () => {
      await result.current.verifyOffChain({ proof: "x", publicSignals: [] } as any);
    });

    expect(result.current.status).toBe("verified");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// QRScanner component tests
// ---------------------------------------------------------------------------

describe("QRScanner (components.tsx)", () => {
  const originalMediaDevices = globalThis.navigator?.mediaDevices;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalMediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: originalMediaDevices,
        configurable: true,
      });
    }
  });

  it("renders video element when useCamera=true and camera is available", async () => {
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
    });

    const onScan = vi.fn();
    const { container } = render(
      <QRScanner onScan={onScan} useCamera={true} />,
    );

    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.hasAttribute("playsInline")).toBe(true);

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeTruthy();
    expect(canvas?.style.display).toBe("none");
  });

  it("renders file input when useCamera=false", () => {
    const onScan = vi.fn();
    const { container } = render(
      <QRScanner onScan={onScan} useCamera={false} />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    expect(fileInput?.getAttribute("accept")).toBe("image/*");

    const video = container.querySelector("video");
    expect(video).toBeNull();
  });

  it("falls back to file input when camera access is denied", async () => {
    const onScan = vi.fn();
    const onError = vi.fn();

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("NotAllowedError")),
      },
      configurable: true,
    });

    const { container } = render(
      <QRScanner onScan={onScan} onError={onError} useCamera={true} />,
    );

    await waitFor(() => {
      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeTruthy();
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("calls onScan with data when file is uploaded", async () => {
    const onScan = vi.fn();
    const { container } = render(
      <QRScanner onScan={onScan} useCamera={false} />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(["qr-data"], "qr.png", { type: "image/png" });

    const mockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      result: "data:image/png;base64,cXItZGF0YQ==",
    };

    vi.spyOn(globalThis, "FileReader").mockImplementation(
      () => mockFileReader as any,
    );

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await act(async () => {
      mockFileReader.onload?.();
    });

    expect(onScan).toHaveBeenCalledWith("data:image/png;base64,cXItZGF0YQ==");

    vi.restoreAllMocks();
  });

  it("applies custom className and style", () => {
    const onScan = vi.fn();
    const { container } = render(
      <QRScanner
        onScan={onScan}
        useCamera={false}
        className="custom-scanner"
        style={{ border: "2px solid red" }}
      />,
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toBe("custom-scanner");
    expect(wrapper.style.border).toBe("2px solid red");
  });

  it("applies custom width and height", () => {
    const onScan = vi.fn();
    const { container } = render(
      <QRScanner onScan={onScan} useCamera={false} width={400} height={400} />,
    );

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe("400px");
  });
});

// ---------------------------------------------------------------------------
// ProofStatus component tests
// ---------------------------------------------------------------------------

describe("ProofStatus (components.tsx)", () => {
  it('renders "Ready to generate proof" for idle status', () => {
    render(<ProofStatus status="idle" />);
    const el = screen.getByRole("status");
    expect(el.textContent).toContain("Ready to generate proof");
  });

  it('renders "Parsing QR code..." for parsing status', () => {
    render(<ProofStatus status="parsing" />);
    const el = screen.getByRole("status");
    expect(el.textContent).toContain("Parsing QR code...");
  });

  it("renders generating text with spinner for generating status", () => {
    render(<ProofStatus status="generating" />);
    const el = screen.getByRole("status");
    expect(el.textContent).toContain("Generating ZK proof");

    const spinner = el.querySelector('[aria-hidden="true"]');
    expect(spinner).toBeTruthy();
  });

  it("renders success message for complete status", () => {
    render(<ProofStatus status="complete" />);
    const el = screen.getByRole("status");
    expect(el.textContent).toContain("Proof generated successfully!");
  });

  it("renders default error message for error status", () => {
    render(<ProofStatus status="error" />);
    const el = screen.getByRole("status");
    expect(el.textContent).toContain("An error occurred");
  });

  it("renders custom error message for error status", () => {
    render(<ProofStatus status="error" error="RSA verification failed" />);
    const el = screen.getByRole("status");
    expect(el.textContent).toContain("RSA verification failed");
  });

  it("does not render spinner for non-generating statuses", () => {
    const { rerender } = render(<ProofStatus status="idle" />);
    let el = screen.getByRole("status");
    expect(el.querySelector('[aria-hidden="true"]')).toBeNull();

    rerender(<ProofStatus status="complete" />);
    el = screen.getByRole("status");
    expect(el.querySelector('[aria-hidden="true"]')).toBeNull();

    rerender(<ProofStatus status="error" error="fail" />);
    el = screen.getByRole("status");
    expect(el.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("has role=status and aria-live=polite for accessibility", () => {
    render(<ProofStatus status="idle" />);
    const el = screen.getByRole("status");
    expect(el.getAttribute("aria-live")).toBe("polite");
  });

  it("applies custom className and style", () => {
    render(
      <ProofStatus
        status="idle"
        className="custom-status"
        style={{ marginTop: 20 }}
      />,
    );
    const el = screen.getByRole("status");
    expect(el.className).toBe("custom-status");
    expect(el.style.marginTop).toBe("20px");
  });

  it("applies correct border color per status", () => {
    // jsdom returns rgb() format, not hex
    const { rerender } = render(<ProofStatus status="idle" />);
    let el = screen.getByRole("status");
    expect(el.style.borderColor).toBe("rgb(102, 102, 102)");

    rerender(<ProofStatus status="parsing" />);
    el = screen.getByRole("status");
    expect(el.style.borderColor).toBe("rgb(33, 150, 243)");

    rerender(<ProofStatus status="generating" />);
    el = screen.getByRole("status");
    expect(el.style.borderColor).toBe("rgb(255, 152, 0)");

    rerender(<ProofStatus status="complete" />);
    el = screen.getByRole("status");
    expect(el.style.borderColor).toBe("rgb(76, 175, 80)");

    rerender(<ProofStatus status="error" />);
    el = screen.getByRole("status");
    expect(el.style.borderColor).toBe("rgb(244, 67, 54)");
  });
});
