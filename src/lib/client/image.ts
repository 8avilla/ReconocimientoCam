/** Downloads an already-uploaded image and re-encodes it as a data URL (e.g. to run local detection on it, or to inline it before an html2canvas capture that can't fetch cross-origin images itself). */
export function urlToDataUrl(url: string): Promise<string> {
  return fetch(url)
    .then((response) => response.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
          reader.readAsDataURL(blob);
        })
    );
}

/**
 * Draws a blob onto a canvas scaled down to at most `maxSize` pixels and returns it as a data URL.
 * Explicit high-quality smoothing: html2canvas's own downscaling of a large source image into a
 * small on-page badge/photo looks noticeably blockier than the browser's native image scaling, so
 * for anything headed into an html2canvas capture, pre-shrinking it here (once, at full quality)
 * avoids leaning on html2canvas to do that scaling itself.
 */
function blobToResizedDataUrl(blob: Blob, maxSize: number, type: "image/png" | "image/jpeg"): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (context) {
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL(type, 0.9));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    image.src = url;
  });
}

/** Reads an image file and returns a JPEG/PNG data URL scaled down to at most `maxSize` pixels. */
export function fileToResizedDataUrl(file: File, maxSize = 512, type: "image/png" | "image/jpeg" = "image/png"): Promise<string> {
  return blobToResizedDataUrl(file, maxSize, type);
}

/** Same as `urlToDataUrl`, but scaled down first — for images headed into an html2canvas capture. */
export async function urlToResizedDataUrl(url: string, maxSize: number, type: "image/png" | "image/jpeg" = "image/png"): Promise<string> {
  const blob = await fetch(url).then((response) => response.blob());
  return blobToResizedDataUrl(blob, maxSize, type);
}
