/**
 * @module @anoncitizen/react/components
 * React components for QR scanning and proof status display.
 */

import { useRef, useEffect, useState, useCallback, type CSSProperties } from "react";
import jsQR from "jsqr";

// ============================================================
// QRScanner
// ============================================================

export interface QRScannerProps {
  /** Called when a QR code is successfully scanned */
  onScan: (data: string) => void;
  /** Called on scan error */
  onError?: (error: Error) => void;
  /** Whether to use the camera (true) or show file upload (false) */
  useCamera?: boolean;
  /** Camera facing mode */
  facingMode?: "user" | "environment";
  /** Width of the scanner viewport */
  width?: number;
  /** Height of the scanner viewport */
  height?: number;
  /** Custom styles for the container */
  style?: CSSProperties;
  /** Custom class name */
  className?: string;
}

/**
 * QR code scanner component for web.
 * Supports webcam scanning and file upload fallback.
 *
 * @example
 * ```tsx
 * <QRScanner
 *   onScan={(data) => console.log("QR data:", data)}
 *   onError={(err) => console.error(err)}
 *   useCamera={true}
 * />
 * ```
 */
export function QRScanner({
  onScan,
  onError,
  useCamera = true,
  facingMode = "environment",
  width = 320,
  height = 320,
  style,
  className,
}: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(useCamera);

  // Start camera
  useEffect(() => {
    if (!hasCamera) return;

    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: width }, height: { ideal: height } },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsScanning(true);
        }
      } catch (err) {
        setHasCamera(false);
        onError?.(
          err instanceof Error ? err : new Error("Camera access denied")
        );
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setIsScanning(false);
    };
  }, [hasCamera, facingMode, width, height, onError]);

  // Scan loop using BarcodeDetector API (Chrome/Edge) or fallback
  useEffect(() => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;

    let animFrame: number;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Use BarcodeDetector if available
    const hasBarcodeDetector = "BarcodeDetector" in globalThis;
    let detector: { detect(source: HTMLCanvasElement): Promise<Array<{ rawValue: string }>> } | null = null;

    if (hasBarcodeDetector) {
      // BarcodeDetector is not yet in all TS lib typings
      const BD = (globalThis as unknown as Record<string, new (opts: { formats: string[] }) => typeof detector>).BarcodeDetector;
      detector = new BD({ formats: ["qr_code"] });
    }

    async function scanFrame() {
      if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animFrame = requestAnimationFrame(scanFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      try {
        if (detector) {
          const barcodes = await detector.detect(canvas);
          if (barcodes.length > 0) {
            onScan(barcodes[0].rawValue);
            return; // Stop scanning after first detection
          }
        }
      } catch {
        // BarcodeDetector failed, continue scanning
      }

      animFrame = requestAnimationFrame(scanFrame);
    }

    animFrame = requestAnimationFrame(scanFrame);
    return () => cancelAnimationFrame(animFrame);
  }, [isScanning, onScan]);

  // File upload handler — decodes QR code from the uploaded image
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          onError?.(new Error("Failed to create canvas context"));
          return;
        }
        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
        if (!qrCode) {
          onError?.(new Error("No QR code found in the image"));
          return;
        }

        onScan(qrCode.data);
      } catch (err) {
        onError?.(
          err instanceof Error ? err : new Error("Failed to read QR image")
        );
      }
    },
    [onScan, onError]
  );

  const containerStyle: CSSProperties = {
    position: "relative",
    width,
    height: hasCamera ? height : "auto",
    overflow: "hidden",
    borderRadius: 8,
    background: "#000",
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      {hasCamera ? (
        <>
          <video
            ref={videoRef}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            playsInline
            muted
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          {!isScanning && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              Starting camera...
            </div>
          )}
        </>
      ) : (
        <div style={{ padding: 16, textAlign: "center" }}>
          <p style={{ color: "#fff", marginBottom: 12 }}>
            Camera not available. Upload a QR code image:
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ color: "#fff" }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// ProofStatus
// ============================================================

export interface ProofStatusProps {
  /** Current proof generation status */
  status: "idle" | "parsing" | "generating" | "complete" | "error";
  /** Error message (when status is "error") */
  error?: string | null;
  /** Custom styles */
  style?: CSSProperties;
  /** Custom class name */
  className?: string;
}

/**
 * Displays proof generation progress.
 *
 * @example
 * ```tsx
 * const { status, error } = useProofGeneration();
 * <ProofStatus status={status} error={error} />
 * ```
 */
export function ProofStatus({ status, error, style, className }: ProofStatusProps) {
  const messages: Record<string, { text: string; color: string }> = {
    idle: { text: "Ready to generate proof", color: "#666" },
    parsing: { text: "Parsing QR code...", color: "#2196F3" },
    generating: { text: "Generating ZK proof... This may take a minute.", color: "#FF9800" },
    complete: { text: "Proof generated successfully!", color: "#4CAF50" },
    error: { text: error ?? "An error occurred", color: "#F44336" },
  };

  const { text, color } = messages[status] ?? messages.idle;

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      style={{
        padding: "12px 16px",
        borderRadius: 8,
        border: `1px solid ${color}`,
        color,
        fontSize: 14,
        ...style,
      }}
    >
      {status === "generating" && (
        <span style={{ marginRight: 8 }} aria-hidden="true">
          &#9696;
        </span>
      )}
      {text}
    </div>
  );
}
