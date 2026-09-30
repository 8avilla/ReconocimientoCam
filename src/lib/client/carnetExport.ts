import { urlToCoverDataUrl } from "./image";

const EXPORT_SCALE = 4;

/** Renders the ID card marked `.carnet-export-target` on the page to a PNG and downloads it. Throws if it can't. */
export async function downloadCarnetImage(publicId: string) {
  const node = document.querySelector<HTMLElement>(".carnet-export-target");
  if (!node) throw new Error("No se encontró el carnet");
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: EXPORT_SCALE,
    useCORS: true,
    onclone: async (clonedDoc) => {
      const targets = Array.from(clonedDoc.querySelectorAll<HTMLElement>('[style*="background-image"]'));
      await Promise.all(
        targets.map(async (element) => {
          const match = /url\("?(https?:[^")]+)"?\)/.exec(element.style.backgroundImage);
          if (!match) return;
          const boxWidth = (Number(element.dataset.carnetW) || 170) * EXPORT_SCALE;
          const boxHeight = (Number(element.dataset.carnetH) || 170) * EXPORT_SCALE;
          try {
            const dataUrl = await urlToCoverDataUrl(match[1], boxWidth, boxHeight);
            const img = clonedDoc.createElement("img");
            img.src = dataUrl;
            img.className = element.className;
            element.replaceWith(img);
          } catch {
            // Leave original
          }
        })
      );
    },
  });
  const link = document.createElement("a");
  link.download = `carnet-${publicId}-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
