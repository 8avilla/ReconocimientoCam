import { describe, expect, it } from "vitest";
import { padRgb } from "./detector";

describe("padRgb", () => {
  it("rodea la imagen con un margen gris y conserva el contenido en el centro", () => {
    const image = { data: Buffer.alloc(4 * 2 * 3, 255), width: 4, height: 2 };
    const padded = padRgb(image, 0.5); // margin = round(4 * 0.5) = 2

    expect(padded.width).toBe(8);
    expect(padded.height).toBe(6);
    expect(padded.data[0]).toBe(128); // corner is gray
    const inner = (2 * padded.width + 2) * 3; // first original pixel
    expect(padded.data[inner]).toBe(255);
    expect(padded.data[(3 * padded.width + 5) * 3]).toBe(255); // last original pixel
    expect(padded.data[(3 * padded.width + 6) * 3]).toBe(128); // right margin
  });
});
