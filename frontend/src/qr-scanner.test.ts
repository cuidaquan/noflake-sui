import { describe, expect, it } from "vitest";
import { canUseNativeQrScanner, qrScannerUnavailableReason } from "./qr-scanner";

describe("native QR scanner capability", () => {
  it("is available only when camera and BarcodeDetector are both present", () => {
    expect(canUseNativeQrScanner({
      BarcodeDetector: class {},
      navigator: { mediaDevices: { getUserMedia: () => undefined } },
    })).toBe(true);

    expect(canUseNativeQrScanner({
      BarcodeDetector: class {},
      navigator: {},
    })).toBe(false);

    expect(canUseNativeQrScanner({
      navigator: { mediaDevices: { getUserMedia: () => undefined } },
    })).toBe(false);
  });

  it("explains which fallback path should be used", () => {
    expect(qrScannerUnavailableReason({})).toBe("Camera scanning is not available in this browser. Paste the QR payload instead.");
    expect(qrScannerUnavailableReason({
      BarcodeDetector: class {},
      navigator: {},
    })).toBe("Camera access is unavailable. Paste the QR payload instead.");
    expect(qrScannerUnavailableReason({
      navigator: { mediaDevices: { getUserMedia: () => undefined } },
    })).toBe("QR detection is not available in this browser. Paste the QR payload instead.");
  });
});
