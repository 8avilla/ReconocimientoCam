import { describe, expect, it } from "vitest";
import { alignFace, ALIGNED_SIZE } from "./align";
import type { Point, RgbImage } from "./detector";

const TEMPLATE: Point[] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

/** Gradient image so that any shift or scaling changes the pixel values. */
function gradient(width: number, height: number): RgbImage {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 3;
      data[index] = (x * 255) / (width - 1);
      data[index + 1] = (y * 255) / (height - 1);
      data[index + 2] = 128;
    }
  }
  return { data, width, height };
}

describe("alignFace", () => {
  it("devuelve la misma imagen cuando los puntos ya están en la posición canónica", () => {
    const image = gradient(ALIGNED_SIZE, ALIGNED_SIZE);
    const aligned = alignFace(image, TEMPLATE);
    let maxDifference = 0;
    for (let i = 0; i < aligned.length; i++) maxDifference = Math.max(maxDifference, Math.abs(aligned[i] - image.data[i]));
    expect(maxDifference).toBeLessThanOrEqual(1);
  });

  it("compensa una traslación de la cara dentro de la imagen", () => {
    const shifted: Point[] = TEMPLATE.map(([x, y]) => [x + 40, y + 25]);
    const image = gradient(300, 300);
    const aligned = alignFace(image, shifted);
    // The canonical top-left corner (0,0) maps to (40,25) in the source.
    expect(Math.abs(aligned[0] - (40 * 255) / 299)).toBeLessThan(2);
    // The nose (canonical 56,72) must sample the source at the shifted nose position (96, 97).
    const noseIndex = (72 * ALIGNED_SIZE + 56) * 3;
    expect(Math.abs(aligned[noseIndex] - (96 * 255) / 299)).toBeLessThan(6);
  });

  it("produce un recorte de 112x112 RGB", () => {
    expect(alignFace(gradient(200, 200), TEMPLATE)).toHaveLength(112 * 112 * 3);
  });
});
