/**
 * @module @anoncitizen/react-native/components
 * React Native components for QR scanning and proof status display.
 */

import { useState, useCallback, type ComponentType } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  type ViewStyle,
  type TextStyle,
} from "react-native";

// ============================================================
// CameraQRScanner
// ============================================================

export interface CameraQRScannerProps {
  /** Called when a QR code is successfully scanned */
  onScan: (data: string) => void;
  /** Called on scan error */
  onError?: (error: Error) => void;
  /** Camera facing direction */
  facing?: "front" | "back";
  /** Custom styles for the container */
  style?: ViewStyle;
}

/**
 * Camera-based QR code scanner using expo-camera.
 *
 * Requires `expo-camera` to be installed and camera permissions granted.
 *
 * @example
 * ```tsx
 * <CameraQRScanner
 *   onScan={(data) => console.log("QR data:", data)}
 *   onError={(err) => console.error(err)}
 *   facing="back"
 * />
 * ```
 */
export function CameraQRScanner({
  onScan,
  onError,
  facing = "back",
  style,
}: CameraQRScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [cameraModule, setCameraModule] = useState<{ CameraView: ComponentType<Record<string, unknown>> } | null>(null);

  // Lazy-load expo-camera to avoid crashes when not installed
  useState(() => {
    (async () => {
      try {
        const mod = await import("expo-camera");
        const { status } = await mod.Camera.requestCameraPermissionsAsync();
        setHasPermission(status === "granted");
        setCameraModule({ CameraView: mod.CameraView as unknown as ComponentType<Record<string, unknown>> });
      } catch (err) {
        onError?.(
          err instanceof Error ? err : new Error("expo-camera not available")
        );
        setHasPermission(false);
      }
    })();
  });

  const CameraView = cameraModule?.CameraView ?? null;

  const handleBarcodeScanned = useCallback(
    ({ data }: { type: string; data: string }) => {
      if (scanned) return;
      setScanned(true);
      onScan(data);
    },
    [scanned, onScan]
  );

  if (hasPermission === null) {
    return (
      <View style={[styles.container, styles.centered, style]}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.statusText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[styles.container, styles.centered, style]}>
        <Text style={styles.errorText}>Camera permission denied</Text>
        <Text style={styles.hintText}>
          Grant camera access in Settings to scan QR codes.
        </Text>
      </View>
    );
  }

  if (!CameraView) {
    return (
      <View style={[styles.container, styles.centered, style]}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={facing}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      {scanned && (
        <View style={[StyleSheet.absoluteFill, styles.centered]}>
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.rescanText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ============================================================
// ImageQRScanner
// ============================================================

export interface ImageQRScannerProps {
  /** Called when a QR code is extracted from the picked image */
  onScan: (data: string) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Button label */
  buttonLabel?: string;
  /** Custom styles for the container */
  style?: ViewStyle;
  /** Custom styles for the button */
  buttonStyle?: ViewStyle;
  /** Custom styles for the button text */
  buttonTextStyle?: TextStyle;
}

/**
 * Picks an image from the gallery and extracts QR code data.
 *
 * Requires `expo-image-picker` to be installed.
 *
 * @example
 * ```tsx
 * <ImageQRScanner
 *   onScan={(data) => console.log("QR data:", data)}
 *   onError={(err) => console.error(err)}
 *   buttonLabel="Pick QR Image"
 * />
 * ```
 */
export function ImageQRScanner({
  onScan,
  onError,
  buttonLabel = "Pick QR Code Image",
  style,
  buttonStyle,
  buttonTextStyle,
}: ImageQRScannerProps) {
  const [loading, setLoading] = useState(false);

  const pickImage = useCallback(async () => {
    setLoading(true);
    try {
      const ImagePicker = await import("expo-image-picker");
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Grant photo library access to pick QR images."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 1,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];

      // Pass the base64 data or URI to the consumer for QR decoding
      // The consumer should use a QR decoding library (e.g., jsQR) on the image data
      if (asset.base64) {
        onScan(asset.base64);
      } else {
        onScan(asset.uri);
      }
    } catch (err) {
      onError?.(
        err instanceof Error ? err : new Error("Failed to pick image")
      );
    } finally {
      setLoading(false);
    }
  }, [onScan, onError]);

  return (
    <View style={[styles.imagePickerContainer, style]}>
      <TouchableOpacity
        style={[styles.pickButton, buttonStyle]}
        onPress={pickImage}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={[styles.pickButtonText, buttonTextStyle]}>
            {buttonLabel}
          </Text>
        )}
      </TouchableOpacity>
    </View>
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
  /** Custom styles for the container */
  style?: ViewStyle;
}

/**
 * Displays proof generation progress (mobile-optimized).
 *
 * @example
 * ```tsx
 * const { status, error } = useProofGeneration();
 * <ProofStatus status={status} error={error} />
 * ```
 */
export function ProofStatus({ status, error, style }: ProofStatusProps) {
  const config: Record<string, { text: string; color: string }> = {
    idle: { text: "Ready to generate proof", color: "#666" },
    parsing: { text: "Parsing QR code...", color: "#2196F3" },
    generating: {
      text: "Generating ZK proof... This may take a minute.",
      color: "#FF9800",
    },
    complete: { text: "Proof generated successfully!", color: "#4CAF50" },
    error: { text: error ?? "An error occurred", color: "#F44336" },
  };

  const { text, color } = config[status] ?? config.idle;

  return (
    <View
      style={[styles.proofStatusContainer, { borderColor: color }, style]}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      {status === "generating" && (
        <ActivityIndicator
          size="small"
          color={color}
          style={styles.proofStatusSpinner}
        />
      )}
      <Text style={[styles.proofStatusText, { color }]}>{text}</Text>
    </View>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 1,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#000",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  statusText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: "#F44336",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  hintText: {
    color: "#999",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  rescanButton: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rescanText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  imagePickerContainer: {
    alignItems: "center",
    padding: 16,
  },
  pickButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 200,
    alignItems: "center",
  },
  pickButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  proofStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  proofStatusSpinner: {
    marginRight: 8,
  },
  proofStatusText: {
    fontSize: 14,
    flex: 1,
  },
});
