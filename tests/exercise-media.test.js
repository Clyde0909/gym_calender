import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const manifest = readJson('src/exercise-media.json');
const catalog = new Set([...readJson('src/exercises-existing.json'), ...readJson('src/exercises-new.json')].map((e) => e.name));
const entries = Object.entries(manifest.exercises);

test('manifest pins the upstream source', () => {
  assert.deepEqual(manifest.source, {
    repository: 'https://github.com/yuhonas/free-exercise-db',
    revision: manifest.source.revision,
    license: 'Unlicense'
  });
  assert.match(manifest.source.revision, /^[0-9a-f]{40}$/);
  assert.deepEqual(Object.keys(manifest), ['source', 'exercises']);
});

test('manifest keys are known canonical catalog names', () => {
  assert.ok(entries.length > 0);
  for (const [name] of entries) assert.ok(catalog.has(name), `unknown catalog name ${name}`);
});

test('each entry has an id and two unique safe local JPEG files', () => {
  for (const [name, entry] of entries) {
    assert.deepEqual(Object.keys(entry), ['id', 'images'], name);
    assert.match(entry.id, /^[A-Za-z0-9_-]+$/, name);
    assert.equal(entry.images.length, 2, name);
    assert.equal(new Set(entry.images).size, 2, name);
    entry.images.forEach((image, index) => {
      assert.equal(image, `exercise-media/${entry.id}/${index}.jpg`, name);
      const bytes = readFileSync(path.join(root, 'public', image));
      assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], image);
      assert.deepEqual([...bytes.subarray(-2)], [0xff, 0xd9], image);
    });
    const [a, b] = entry.images.map((image) => readFileSync(path.join(root, 'public', image)));
    assert.ok(!a.equals(b), `${name} images are identical`);
  }
});

test('bundled Unlicense text is present', () => {
  const license = readFileSync(path.join(root, 'public/exercise-media/LICENSE.md'), 'utf8');
  assert.match(license, /unlicense/i);
  assert.match(license, /public domain/i);
});
