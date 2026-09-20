import jsQR from "jsqr";

interface Frame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Returns the text encoded in the QR code found in the frame, or null when there is none. */
export function decodeQr(frame: Frame): string | null {
  return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })?.data ?? null;
}
