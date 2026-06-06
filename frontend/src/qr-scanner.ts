interface ScannerLikeGlobal {
  BarcodeDetector?: unknown;
  navigator?: {
    mediaDevices?: {
      getUserMedia?: unknown;
    };
  };
}

export function canUseNativeQrScanner(scope: ScannerLikeGlobal = globalThis): boolean {
  return Boolean(scope.BarcodeDetector && scope.navigator?.mediaDevices?.getUserMedia);
}

export function qrScannerUnavailableReason(scope: ScannerLikeGlobal = globalThis): string {
  const hasCamera = Boolean(scope.navigator?.mediaDevices?.getUserMedia);
  const hasDetector = Boolean(scope.BarcodeDetector);
  if (!hasCamera && !hasDetector) {
    return "Camera scanning is not available in this browser. Paste the QR payload instead.";
  }
  if (!hasCamera) {
    return "Camera access is unavailable. Paste the QR payload instead.";
  }
  return "QR detection is not available in this browser. Paste the QR payload instead.";
}
