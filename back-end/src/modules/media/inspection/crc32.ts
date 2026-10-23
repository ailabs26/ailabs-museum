/**
 * Tính toán checksum IEEE 802.3 CRC-32 (ISO 3309) tương thích mọi môi trường Node.js.
 * Khắc phục lỗi `node:zlib.crc32` không tồn tại trên Node.js < 22.2.0 (ví dụ Node 18/20 LTS).
 */
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

export function crc32(buffer: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

