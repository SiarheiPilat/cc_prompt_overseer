import fs from "node:fs";

export type LineVisitor = (raw: string, byteStart: number, byteEnd: number) => void;

/** Stream a file line-by-line starting from `startByte`. Returns the byte offset
 *  after the last complete line read (so the caller can resume from there). */
export function streamLines(filePath: string, startByte: number, onLine: LineVisitor): number {
  const size = fs.statSync(filePath).size;
  if (startByte >= size) return size;
  const fd = fs.openSync(filePath, "r");
  const CHUNK = 1 << 20; // 1 MiB
  const buf = Buffer.alloc(CHUNK);
  let pos = startByte;
  let lineStart = pos;
  let carry: Buffer | null = null;
  try {
    while (pos < size) {
      const n = fs.readSync(fd, buf, 0, Math.min(CHUNK, size - pos), pos);
      if (n <= 0) break;
      let offsetInChunk = 0;
      const work = carry ? Buffer.concat([carry, buf.subarray(0, n)]) : buf.subarray(0, n);
      const carryPrefixLen = carry ? carry.length : 0;
      for (let i = 0; i < work.length; i++) {
        if (work[i] === 0x0a /* \n */) {
          const start = pos - carryPrefixLen + offsetInChunk;
          const end = pos - carryPrefixLen + i + 1;
          let lineBuf = work.subarray(offsetInChunk, i);
          // strip trailing \r
          if (lineBuf.length && lineBuf[lineBuf.length - 1] === 0x0d) {
            lineBuf = lineBuf.subarray(0, lineBuf.length - 1);
          }
          if (lineBuf.length) {
            try { onLine(lineBuf.toString("utf8"), start, end); } catch (e) { /* skip bad line */ }
          }
          offsetInChunk = i + 1;
          lineStart = end;
        }
      }
      if (offsetInChunk < work.length) {
        carry = Buffer.from(work.subarray(offsetInChunk));
      } else {
        carry = null;
      }
      pos += n;
    }
  } finally {
    fs.closeSync(fd);
  }
  return lineStart;
}

export function safeParse<T = any>(line: string): T | null {
  try { return JSON.parse(line) as T; } catch { return null; }
}
