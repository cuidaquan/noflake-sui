interface ScannerLikeGlobal {
  BarcodeDetector?: unknown;
  navigator?: {
    mediaDevices?: {
      getUserMedia?: unknown;
    };
  };
}

export type JsQrDecoder = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data?: string } | null;

export function canUseNativeQrScanner(scope: ScannerLikeGlobal = globalThis): boolean {
  return Boolean(scope.BarcodeDetector && scope.navigator?.mediaDevices?.getUserMedia);
}

export function canUseCameraQrScanner(scope: ScannerLikeGlobal = globalThis, hasJsDecoder = true): boolean {
  return Boolean(scope.navigator?.mediaDevices?.getUserMedia && (scope.BarcodeDetector || hasJsDecoder));
}

export function qrScannerUnavailableReason(scope: ScannerLikeGlobal = globalThis, hasJsDecoder = true): string {
  const hasCamera = Boolean(scope.navigator?.mediaDevices?.getUserMedia);
  const hasDetector = Boolean(scope.BarcodeDetector);
  const hasQrDecoder = hasDetector || hasJsDecoder;
  if (!hasCamera && !hasQrDecoder) {
    return "Camera scanning is not available in this browser. Paste the QR payload instead.";
  }
  if (!hasCamera) {
    return "Camera access is unavailable. Paste the QR payload instead.";
  }
  return "QR detection is not available in this browser. Paste the QR payload instead.";
}

export function decodeQrPayloadFromImageData(imageData: ImageData, decode: JsQrDecoder): string | null {
  const result = decode(imageData.data, imageData.width, imageData.height);
  return result?.data?.trim() ? result.data : null;
}
