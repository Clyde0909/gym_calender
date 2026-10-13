import { t } from "./i18n.js";
const heifBrands = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);
export async function isHighEfficiency(file) {
  if (
    /\.(heic|heif)$/i.test(file.name || "") ||
    /^image\/hei[cf](?:-sequence)?$/i.test(file.type)
  )
    return true;
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const text = new TextDecoder("ascii").decode(bytes);
  if (text.slice(4, 8) !== "ftyp") return false;
  for (let offset = 8; offset + 4 <= text.length; offset += 4)
    if (heifBrands.has(text.slice(offset, offset + 4))) return true;
  return false;
}
export async function decodePhoto(file) {
  const highEfficiency = await isHighEfficiency(file);
  if (
    !highEfficiency &&
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
    !/\.(jpe?g|png|webp)$/i.test(file.name || "")
  )
    throw Error(t("photoUnsupported"));
  // Recent Safari can decode HEIC directly; other browsers use a bundled local decoder.
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (!highEfficiency) throw Error(t("photoUnreadable"));
    try {
      const { heicTo } = await import("heic-to/next");
      return await heicTo({ blob: file, type: "bitmap" });
    } catch {
      throw Error(t("heicDecodeFailed"));
    }
  }
}
