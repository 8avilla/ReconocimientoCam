/**
 * Small copies of the images that show up as little avatars (a list of 30 players, team shields next to every match).
 * Each is stored next to the original with `_s` before the extension, at upload time (`uploadImage`) and for older
 * images with `npm run thumbs`. Serving them straight from storage costs the server nothing, where the image
 * optimizer would have to download and resize every one the first time it is seen.
 *
 * Off until the old images have their copy (`NEXT_PUBLIC_IMAGE_THUMBS=1`); an image without one falls back to the original.
 */
export const THUMBS_ENABLED = process.env.NEXT_PUBLIC_IMAGE_THUMBS === "1";

/** Only these folders hold images shown as avatars. */
export const THUMB_FOLDERS = ["players/photos/", "players/faces/", "teams/shields/", "championships/logos/"];
export const THUMB_SIZE = 160;
/** The biggest avatar that uses the copy: bigger ones (a profile photo) want the original. */
export const THUMB_MAX_DISPLAY = 96;

const EXTENSION = /\.(jpg|jpeg|png)$/i;

/** Where the small copy of a stored image lives, or null when this kind of image has none. */
export function thumbName(blobNameOrUrl: string): string | null {
  const path = blobNameOrUrl.split("?")[0];
  if (!THUMB_FOLDERS.some((folder) => path.includes(`/${folder}`) || path.startsWith(folder)) || !EXTENSION.test(path)) return null;
  return path.replace(EXTENSION, (extension) => `_s${extension}`);
}

/** The URL to use for an avatar of `size` px: the small copy when there is one, else the image as it is. */
export function avatarSrc(url: string, size: number): { src: string; fallback?: string } {
  if (!THUMBS_ENABLED || size > THUMB_MAX_DISPLAY) return { src: url };
  const thumb = thumbName(url);
  if (!thumb) return { src: url };
  // Keep the query string (a signed URL) with the copy.
  const query = url.includes("?") ? url.slice(url.indexOf("?")) : "";
  return { src: thumb + query, fallback: url };
}
