import media from "./exercise-media.json" with { type: "json" };

const base = import.meta.env.BASE_URL;
const { source, exercises } = media;

export function exerciseMedia(name) {
  const entry = Object.hasOwn(exercises, name) ? exercises[name] : null;
  if (!entry) return null;
  return {
    images: entry.images.map((path) => base + path),
    sourceUrl: `${source.repository}/tree/${source.revision}/exercises/${entry.id}`,
    license: source.license,
    licenseUrl: `${base}exercise-media/LICENSE.md`,
  };
}
