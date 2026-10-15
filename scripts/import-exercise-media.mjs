// Reproducibly downloads the pinned free-exercise-db assets listed in
// src/exercise-media.json into public/exercise-media/.
// Usage: node scripts/import-exercise-media.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'src/exercise-media.json'), 'utf8'));
const { repository, revision } = manifest.source;
const rawBase = repository.replace('https://github.com/', 'https://raw.githubusercontent.com/') + '/' + revision;
const outDir = path.join(root, 'public/exercise-media');

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function assertJpeg(bytes, url) {
  const isJpeg = bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  if (!isJpeg) throw new Error(`Not a JPEG: ${url}`);
}

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'LICENSE.md'), await fetchBytes(`${rawBase}/LICENSE.md`));

let files = 0;
let total = 0;
for (const [name, { id, images }] of Object.entries(manifest.exercises)) {
  for (const [index, image] of images.entries()) {
    const url = `${rawBase}/exercises/${encodeURIComponent(id)}/${index}.jpg`;
    const bytes = await fetchBytes(url);
    assertJpeg(bytes, url);
    const target = path.join(root, 'public', image);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    files += 1;
    total += bytes.length;
  }
  console.log(`${name} <- ${id}`);
}
console.log(`${files} images, ${total} bytes`);
