import LZString from "lz-string";

export const compress = (text) => LZString.compressToUint8Array(text);

// Bounded reader of LZ-String's UTF-16 bitstream (MIT, Pieroxy).
// Check output growth before joining, so an imported compression bomb cannot
// allocate an unbounded decoded string. The final UTF-8 limit is checked too.
export function decompress(bytes, limit) {
  if (!bytes.length || bytes.length % 2) throw Error("Invalid LZ stream");
  let bit = 0;
  function read(count) {
    let value = 0;
    for (let i = 0; i < count; i++, bit++) {
      if (bit >= bytes.length * 8) throw Error("Truncated LZ stream");
      value += ((bytes[bit >> 3] >> (7 - (bit & 7))) & 1) * 2 ** i;
    }
    return value;
  }
  const dictionary = [null, null, null];
  const first = read(2);
  if (first === 2) return "";
  if (first > 1) throw Error("Invalid LZ stream");
  let previous = String.fromCharCode(read(first === 0 ? 8 : 16));
  dictionary.push(previous);
  const result = [previous];
  let size = previous.length,
    width = 3,
    remaining = 4;
  while (true) {
    let code = read(width);
    if (code === 2) return result.join("");
    if (code < 2) {
      dictionary.push(String.fromCharCode(read(code === 0 ? 8 : 16)));
      code = dictionary.length - 1;
      remaining--;
    }
    if (remaining === 0) {
      remaining = 2 ** width;
      width++;
    }
    const entry =
      dictionary[code] ??
      (code === dictionary.length ? previous + previous[0] : null);
    if (entry === null) throw Error("Invalid LZ dictionary");
    size += entry.length;
    if (size > limit) throw Error("LZ output exceeds limit");
    result.push(entry);
    dictionary.push(previous + entry[0]);
    remaining--;
    previous = entry;
    if (remaining === 0) {
      remaining = 2 ** width;
      width++;
    }
  }
}
