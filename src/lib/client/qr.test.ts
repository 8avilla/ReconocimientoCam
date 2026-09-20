import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { decodeQr } from "./qr";

/** Renders a QR code into an RGBA frame with a quiet zone, like a camera frame of a printed card. */
function renderFrame(text: string, scale = 6, margin = 4) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const modules = qr.modules.size;
  const side = (modules + margin * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (!qr.modules.get(row, col)) continue;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const index = (((row + margin) * scale + y) * side + (col + margin) * scale + x) * 4;
          data[index] = data[index + 1] = data[index + 2] = 0;
        }
      }
    }
  }
  return { data, width: side, height: side };
}

describe("decodeQr", () => {
  it("lee el identificador público del carnet", () => {
    expect(decodeQr(renderFrame("PLR-7EDBEF03BDB6"))).toBe("PLR-7EDBEF03BDB6");
  });

  it("devuelve null cuando no hay un QR en el cuadro", () => {
    const blank = { data: new Uint8ClampedArray(200 * 200 * 4).fill(255), width: 200, height: 200 };
    expect(decodeQr(blank)).toBeNull();
  });
});
