import type { Point, RgbImage } from "./detector";

/** ArcFace canonical landmark positions inside a 112x112 crop. */
const ARCFACE_TEMPLATE: Point[] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];
export const ALIGNED_SIZE = 112;

interface Similarity {
  scale: number;
  cos: number;
  sin: number;
  tx: number;
  ty: number;
}

/** Least-squares similarity transform (rotation + uniform scale + translation) from src to dst points. */
function estimateSimilarity(src: Point[], dst: Point[]): Similarity {
  const n = src.length;
  const mean = (points: Point[]): Point => [
    points.reduce((sum, p) => sum + p[0], 0) / n,
    points.reduce((sum, p) => sum + p[1], 0) / n,
  ];
  const [sx, sy] = mean(src);
  const [dx, dy] = mean(dst);

  let a = 0; // sum(src . dst)
  let b = 0; // sum(src x dst)
  let norm = 0;
  for (let i = 0; i < n; i++) {
    const px = src[i][0] - sx;
    const py = src[i][1] - sy;
    const qx = dst[i][0] - dx;
    const qy = dst[i][1] - dy;
    a += px * qx + py * qy;
    b += px * qy - py * qx;
    norm += px * px + py * py;
  }
  const scale = Math.sqrt(a * a + b * b) / norm;
  const cos = a / Math.hypot(a, b);
  const sin = b / Math.hypot(a, b);
  return {
    scale,
    cos,
    sin,
    tx: dx - scale * (cos * sx - sin * sy),
    ty: dy - scale * (sin * sx + cos * sy),
  };
}

/** Warps the face into the canonical 112x112 ArcFace crop (bilinear sampling, RGB). */
export function alignFace(image: RgbImage, landmarks: Point[]): Buffer {
  const { scale, cos, sin, tx, ty } = estimateSimilarity(landmarks, ARCFACE_TEMPLATE);
  const out = Buffer.alloc(ALIGNED_SIZE * ALIGNED_SIZE * 3);

  for (let y = 0; y < ALIGNED_SIZE; y++) {
    for (let x = 0; x < ALIGNED_SIZE; x++) {
      // Inverse mapping: destination pixel -> source coordinates.
      const px = x - tx;
      const py = y - ty;
      const srcX = (cos * px + sin * py) / scale;
      const srcY = (-sin * px + cos * py) / scale;

      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const fx = srcX - x0;
      const fy = srcY - y0;
      const target = (y * ALIGNED_SIZE + x) * 3;

      for (let channel = 0; channel < 3; channel++) {
        const sample = (xx: number, yy: number) => {
          if (xx < 0 || yy < 0 || xx >= image.width || yy >= image.height) return 0;
          return image.data[(yy * image.width + xx) * 3 + channel];
        };
        out[target + channel] = Math.round(
          sample(x0, y0) * (1 - fx) * (1 - fy) +
            sample(x0 + 1, y0) * fx * (1 - fy) +
            sample(x0, y0 + 1) * (1 - fx) * fy +
            sample(x0 + 1, y0 + 1) * fx * fy
        );
      }
    }
  }
  return out;
}
