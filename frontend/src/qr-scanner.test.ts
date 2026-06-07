import { describe, expect, it } from "vitest";
import {
  canUseCameraQrScanner,
  canUseNativeQrScanner,
  decodeQrPayloadFromImageData,
  qrScannerUnavailableReason,
} from "./qr-scanner";

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

  it("can scan with a camera and JS decoder fallback when BarcodeDetector is missing", () => {
    expect(canUseCameraQrScanner({
      navigator: { mediaDevices: { getUserMedia: () => undefined } },
    }, true)).toBe(true);

    expect(canUseCameraQrScanner({
      navigator: { mediaDevices: { getUserMedia: () => undefined } },
    }, false)).toBe(false);
  });

  it("explains which fallback path should be used", () => {
    expect(qrScannerUnavailableReason({})).toBe("Camera access is unavailable. Paste the QR payload instead.");
    expect(qrScannerUnavailableReason({
      BarcodeDetector: class {},
      navigator: {},
    })).toBe("Camera access is unavailable. Paste the QR payload instead.");
    expect(qrScannerUnavailableReason({
      navigator: { mediaDevices: { getUserMedia: () => undefined } },
    }, false)).toBe("QR detection is not available in this browser. Paste the QR payload instead.");
  });

  it("decodes a QR payload from image data with the JS decoder", () => {
    const imageData = {
      data: new Uint8ClampedArray([1, 2, 3, 4]),
      width: 1,
      height: 1,
    } as ImageData;

    const payload = decodeQrPayloadFromImageData(imageData, (data, width, height) => {
      expect(data).toBe(imageData.data);
      expect(width).toBe(1);
      expect(height).toBe(1);
      return { data: "noflake_check_in_payload" };
    });

    expect(payload).toBe("noflake_check_in_payload");
    expect(decodeQrPayloadFromImageData(imageData, () => null)).toBeNull();
  });
});
