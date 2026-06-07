interface ScannerLikeGlobal {
  BarcodeDetector?: unknown;
  navigator?: {
    mediaDevices?: {
      getUserMedia?: unknown;
    };
  };
}

interface ImageDataLike {
  data: Uint8ClampedArray;
  width: number;
  height: number;
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

function cropCenter(imageData: ImageDataLike, scale: number): ImageDataLike {
  const width = Math.max(1, Math.round(imageData.width * scale));
  const height = Math.max(1, Math.round(imageData.height * scale));
  const left = Math.floor((imageData.width - width) / 2);
  const top = Math.floor((imageData.height - height) / 2);
  const data = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row += 1) {
    const sourceStart = ((top + row) * imageData.width + left) * 4;
    const sourceEnd = sourceStart + width * 4;
    data.set(imageData.data.subarray(sourceStart, sourceEnd), row * width * 4);
  }

  return { data, width, height };
}

export function decodeQrPayloadFromImageData(imageData: ImageDataLike, decode: JsQrDecoder): string | null {
  const attempts = [
    imageData,
    cropCenter(imageData, 0.9),
    cropCenter(imageData, 0.75),
    cropCenter(imageData, 0.6),
  ];

  for (const attempt of attempts) {
    const result = decode(attempt.data, attempt.width, attempt.height);
    if (result?.data?.trim()) return result.data;
  }

  return null;
}
