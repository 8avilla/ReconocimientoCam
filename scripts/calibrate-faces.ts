/**
 * Face verification calibration.
 *
 * Usage:
 *   npm run calibrate -- <photos-dir> [--max-people 300] [--max-per-person 4] [--min-images 2]
 *                        [--cache embeddings.json] [--stress 300] [--out report.json]
 * --cache reuses previously computed embeddings; --stress N also degrades N people's probe photos
 * (dark, low resolution, noise + heavy JPEG) to estimate accuracy under field conditions.
 *
 * <photos-dir> holds one sub-folder per person with at least two photos each
 * (e.g. LFW layout: dir/Person_Name/Person_Name_0001.jpg). It compares how well "same person"
 * and "different person" similarity scores separate, for two pipelines:
 *   - legacy:  square crop around the face, stretched to 112x112 (approximates the old browser crop)
 *   - aligned: detection + 5-point alignment to the ArcFace template (current server pipeline)
 * and proposes thresholds for a target false-accept rate.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { decodeRgb, detectFaces, type DetectedFace } from "@/lib/faceEngine/detector";
import { alignFace } from "@/lib/faceEngine/align";
import { cosineSimilarity, getEmbeddingFromRgb } from "@/lib/faceEngine/embedding";

type PipelineName = "legacy" | "aligned";
const PIPELINES: PipelineName[] = ["legacy", "aligned"];
const IMAGE_PATTERN = /\.(jpe?g|png|webp)$/i;
// The old browser crop used the MediaPipe landmark bounding box (larger than the detector box) plus 35% padding.
const LEGACY_BOX_SCALE = 1.2;
const LEGACY_PADDING = 1.35;
const FAR_TARGETS = [1e-2, 1e-3, 1e-4];
const THRESHOLD_GRID = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];

function argument(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? Number(process.argv[index + 1]) : fallback;
}

/** Deterministic PRNG so runs are reproducible. */
function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function legacyCrop(image: Awaited<ReturnType<typeof decodeRgb>>, face: DetectedFace): Promise<Buffer> {
  const [x1, y1, x2, y2] = face.box;
  const side = Math.round(Math.max(x2 - x1, y2 - y1) * LEGACY_BOX_SCALE * LEGACY_PADDING);
  const left = Math.round((x1 + x2) / 2 - side / 2);
  const top = Math.round((y1 + y2) / 2 - side / 2);

  // Copy the overlapping region onto a black square: areas outside the frame stay black,
  // like the edge of a video frame would.
  const canvas = Buffer.alloc(side * side * 3);
  const overlapLeft = Math.max(0, left);
  const overlapRight = Math.min(image.width, left + side);
  for (let y = Math.max(0, top); y < Math.min(image.height, top + side); y++) {
    const from = (y * image.width + overlapLeft) * 3;
    image.data.copy(canvas, ((y - top) * side + (overlapLeft - left)) * 3, from, from + (overlapRight - overlapLeft) * 3);
  }
  return sharp(canvas, { raw: { width: side, height: side, channels: 3 } })
    .resize(112, 112, { fit: "fill" })
    .raw()
    .toBuffer();
}

type Degradation = "dark" | "low_resolution" | "noisy_jpeg";
const DEGRADATIONS: Degradation[] = ["dark", "low_resolution", "noisy_jpeg"];

/** Simulates poor capture conditions on a decoded photo; returns the degraded photo as RGB. */
async function degrade(image: Awaited<ReturnType<typeof decodeRgb>>, kind: Degradation, random: () => number) {
  const raw = { raw: { width: image.width, height: image.height, channels: 3 as const } };
  if (kind === "dark") {
    return decodeRgb(await sharp(image.data, raw).linear(0.4, 0).jpeg({ quality: 90 }).toBuffer());
  }
  if (kind === "low_resolution") {
    const small = await sharp(image.data, raw).resize(Math.round(image.width * 0.3)).blur(1.2).jpeg({ quality: 85 }).toBuffer();
    return decodeRgb(await sharp(small).resize(image.width, image.height).jpeg({ quality: 85 }).toBuffer());
  }
  const noisy = Buffer.from(image.data);
  for (let i = 0; i < noisy.length; i++) {
    // Box-Muller gaussian noise (sigma ~ 18).
    const noise = Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random()) * 18;
    noisy[i] = Math.max(0, Math.min(255, noisy[i] + noise));
  }
  return decodeRgb(await sharp(noisy, raw).jpeg({ quality: 25 }).toBuffer());
}

function rateAtOrAbove(values: number[], threshold: number): number {
  return values.filter((value) => value >= threshold).length / Math.max(1, values.length);
}

interface Sample {
  person: string;
  file: string;
  embeddings: Partial<Record<PipelineName, Float32Array>>;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))];
}

function describe(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return {
    count: values.length,
    mean: +mean.toFixed(4),
    min: +sorted[0].toFixed(4),
    p1: +percentile(sorted, 0.01).toFixed(4),
    p5: +percentile(sorted, 0.05).toFixed(4),
    median: +percentile(sorted, 0.5).toFixed(4),
    p95: +percentile(sorted, 0.95).toFixed(4),
    p99: +percentile(sorted, 0.99).toFixed(4),
    max: +sorted[sorted.length - 1].toFixed(4),
  };
}

async function main() {
  const directory = process.argv[2];
  if (!directory || directory.startsWith("--") || !fs.existsSync(directory)) {
    throw new Error("Usage: npm run calibrate -- <photos-dir> [--max-people N] [--max-per-person N] [--out file.json]");
  }
  const maxPeople = argument("max-people", 300);
  const maxPerPerson = argument("max-per-person", 4);
  const minImages = argument("min-images", 2);
  const outIndex = process.argv.indexOf("--out");
  const random = mulberry32(42);

  const people = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      files: fs.readdirSync(path.join(directory, entry.name)).filter((file) => IMAGE_PATTERN.test(file)).sort(),
    }))
    .filter((person) => person.files.length >= minImages);
  const selected = shuffle(people, random).slice(0, maxPeople);
  console.log(`People with >= ${minImages} photos: ${people.length}; using ${selected.length}`);

  const cacheIndex = process.argv.indexOf("--cache");
  const cachePath = cacheIndex >= 0 ? process.argv[cacheIndex + 1] : undefined;

  let samples: Sample[] = [];
  let detectionFailures = { total: 0, noFace: 0 };
  let processed = 0;
  if (cachePath && fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf8")) as {
      detectionFailures: typeof detectionFailures;
      samples: { person: string; file: string; embeddings: Record<PipelineName, number[]> }[];
    };
    detectionFailures = cached.detectionFailures;
    samples = cached.samples.map((sample) => ({
      ...sample,
      embeddings: { legacy: Float32Array.from(sample.embeddings.legacy), aligned: Float32Array.from(sample.embeddings.aligned) },
    }));
    console.log(`Loaded ${samples.length} cached embeddings from ${cachePath}`);
  }
  for (const person of samples.length > 0 ? [] : selected) {
    for (const file of shuffle(person.files, random).slice(0, maxPerPerson)) {
      detectionFailures.total += 1;
      try {
        const image = await decodeRgb(fs.readFileSync(path.join(directory, person.name, file)));
        const faces = await detectFaces(image);
        if (faces.length === 0) {
          detectionFailures.noFace += 1;
          continue;
        }
        // Largest face, like the server does.
        const face = faces.sort((a, b) => (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]) - (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]))[0];
        samples.push({
          person: person.name,
          file,
          embeddings: {
            legacy: await getEmbeddingFromRgb(await legacyCrop(image, face)),
            aligned: await getEmbeddingFromRgb(alignFace(image, face.landmarks)),
          },
        });
      } catch (error) {
        detectionFailures.noFace += 1;
        console.error(`Skipping ${person.name}/${file}:`, error instanceof Error ? error.message : error);
      }
      if (++processed % 100 === 0) console.log(`  processed ${processed} photos...`);
    }
  }

  if (cachePath && !fs.existsSync(cachePath)) {
    fs.writeFileSync(
      cachePath,
      JSON.stringify({
        detectionFailures,
        samples: samples.map((sample) => ({
          ...sample,
          embeddings: { legacy: Array.from(sample.embeddings.legacy!), aligned: Array.from(sample.embeddings.aligned!) },
        })),
      })
    );
    console.log(`Embeddings cached in ${cachePath}`);
  }

  // Keep only people that still have two usable photos.
  const byPerson = new Map<string, Sample[]>();
  for (const sample of samples) byPerson.set(sample.person, [...(byPerson.get(sample.person) ?? []), sample]);
  const usable = [...byPerson.values()].filter((list) => list.length >= 2);
  const pool = usable.flat();
  console.log(`Usable photos: ${pool.length} from ${usable.length} people; no-face rate ${(100 * detectionFailures.noFace / detectionFailures.total).toFixed(2)}%`);

  const report: Record<string, unknown> = {
    photos: pool.length,
    people: usable.length,
    noFaceRate: detectionFailures.noFace / detectionFailures.total,
  };

  for (const pipeline of PIPELINES) {
    const genuine: number[] = [];
    const impostor: number[] = [];
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const score = cosineSimilarity(pool[i].embeddings[pipeline]!, pool[j].embeddings[pipeline]!);
        (pool[i].person === pool[j].person ? genuine : impostor).push(score);
      }
    }

    const sortedImpostor = [...impostor].sort((a, b) => a - b);
    const sortedGenuine = [...genuine].sort((a, b) => a - b);
    const rateAbove = (sorted: number[], threshold: number) => {
      let low = 0;
      let high = sorted.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (sorted[mid] < threshold) low = mid + 1;
        else high = mid;
      }
      return (sorted.length - low) / sorted.length;
    };

    // Equal error rate: threshold where false accepts and false rejects are closest.
    let eer = { threshold: 0, rate: 1, gap: Infinity };
    for (let t = -0.2; t <= 1; t += 0.005) {
      const far = rateAbove(sortedImpostor, t);
      const frr = 1 - rateAbove(sortedGenuine, t);
      if (Math.abs(far - frr) < eer.gap) eer = { threshold: +t.toFixed(3), rate: +((far + frr) / 2).toFixed(4), gap: Math.abs(far - frr) };
    }

    const atFar = FAR_TARGETS.map((target) => {
      const threshold = sortedImpostor[Math.min(sortedImpostor.length - 1, Math.floor((1 - target) * sortedImpostor.length))];
      return {
        targetFar: target,
        threshold: +threshold.toFixed(4),
        // Share of genuine attempts that would be accepted (true accept rate).
        tar: +rateAbove(sortedGenuine, threshold).toFixed(4),
      };
    });

    const grid = THRESHOLD_GRID.map((threshold) => ({
      threshold,
      far: rateAbove(sortedImpostor, threshold),
      tar: rateAbove(sortedGenuine, threshold),
    }));

    report[pipeline] = {
      genuine: describe(genuine),
      impostor: describe(impostor),
      eer: { threshold: eer.threshold, rate: eer.rate },
      atFar,
      grid,
    };
    console.log(`\n=== Pipeline: ${pipeline} ===`);
    console.log("same person   :", JSON.stringify(describe(genuine)));
    console.log("different     :", JSON.stringify(describe(impostor)));
    console.log("equal error   :", JSON.stringify({ threshold: eer.threshold, rate: eer.rate }));
    console.log("threshold for target false-accept rate:");
    for (const row of atFar) console.log(`  FAR <= ${row.targetFar}: threshold ${row.threshold}  -> genuine accepted ${(row.tar * 100).toFixed(1)}%`);
    console.log("fixed thresholds (false accepts / genuine accepted):");
    for (const row of grid) console.log(`  ${row.threshold.toFixed(2)}: FAR ${(row.far * 100).toFixed(4)}%  TAR ${(row.tar * 100).toFixed(1)}%`);
  }

  const stressPeople = argument("stress", 0);
  if (stressPeople > 0) {
    // Enrollment = first (clean) photo of a person; probes = degraded versions of their other photos.
    const subset = usable.slice(0, stressPeople);
    const enrollments = subset.map((list) => list[0]);
    const stress: Record<string, unknown> = {};
    for (const kind of DEGRADATIONS) {
      const genuine: number[] = [];
      const impostor: number[] = [];
      let lost = 0;
      let attempts = 0;
      for (const [index, list] of subset.entries()) {
        for (const probe of list.slice(1)) {
          attempts += 1;
          try {
            const image = await degrade(await decodeRgb(fs.readFileSync(path.join(directory, probe.person, probe.file))), kind, random);
            const faces = await detectFaces(image);
            if (faces.length === 0) {
              lost += 1;
              continue;
            }
            const face = faces.sort((a, b) => (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]) - (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]))[0];
            const embedding = await getEmbeddingFromRgb(alignFace(image, face.landmarks));
            enrollments.forEach((enrolled, other) => {
              (other === index ? genuine : impostor).push(cosineSimilarity(embedding, enrolled.embeddings.aligned!));
            });
          } catch {
            lost += 1;
          }
        }
      }
      const rows = THRESHOLD_GRID.map((threshold) => ({ threshold, tar: rateAtOrAbove(genuine, threshold), far: rateAtOrAbove(impostor, threshold) }));
      stress[kind] = { probes: attempts, faceNotDetected: lost, genuine: describe(genuine), impostor: describe(impostor), grid: rows };
      console.log(`\n=== Stress: ${kind} (${attempts} probes, face not detected in ${lost}) ===`);
      console.log("same person   :", JSON.stringify(describe(genuine)));
      console.log("different     :", JSON.stringify(describe(impostor)));
      for (const row of rows) console.log(`  ${row.threshold.toFixed(2)}: FAR ${(row.far * 100).toFixed(4)}%  TAR ${(row.tar * 100).toFixed(1)}%`);
    }
    report.stress = stress;
  }

  if (outIndex >= 0) {
    fs.writeFileSync(process.argv[outIndex + 1], JSON.stringify(report, null, 2));
    console.log(`\nReport written to ${process.argv[outIndex + 1]}`);
  }
}

main().catch((error) => {
  console.error("Calibration failed:", error);
  process.exitCode = 1;
});
