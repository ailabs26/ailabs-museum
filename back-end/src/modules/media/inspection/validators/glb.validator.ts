import { MediaErrorCode, MediaFormatError, corrupted } from '../media-format.error';

const HEADER_LENGTH = 12;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const EMBEDDED_DATA_URI = /^data:[\w.+-]+\/[\w.+-]+;base64,([A-Za-z0-9+/=]*)$/;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function externalResource(path: string): MediaFormatError {
  return new MediaFormatError(
    MediaErrorCode.EXTERNAL_RESOURCE,
    `Model tham chiếu tài nguyên bên ngoài (${path}) — chỉ chấp nhận tài nguyên nhúng trong file GLB`,
  );
}

/** Lấy mảng tùy chọn của tài liệu glTF; báo lỗi nếu có nhưng sai kiểu. */
function optionalArray(document: JsonObject, key: string): unknown[] {
  const value = document[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw corrupted(`Trường "${key}" của glTF phải là mảng`);
  return value;
}

function parseJsonChunk(bytes: Buffer): JsonObject {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw corrupted('Chunk JSON của GLB không phải UTF-8 hợp lệ');
  }
  let document: unknown;
  try {
    document = JSON.parse(text.replace(/[\s\0]+$/, ''));
  } catch {
    throw corrupted('Chunk JSON của GLB không parse được');
  }
  if (!isObject(document)) throw corrupted('Nội dung JSON của GLB phải là object');
  return document;
}

/** Trả về byteLength của từng buffer sau khi xác nhận buffer là tài nguyên nhúng. */
function validateBuffers(document: JsonObject, bin: Buffer | null): number[] {
  return optionalArray(document, 'buffers').map((entry, index) => {
    if (!isObject(entry) || !isNonNegativeInteger(entry.byteLength) || entry.byteLength < 1) {
      throw corrupted(`buffers[${index}].byteLength không hợp lệ`);
    }
    if (entry.uri === undefined) {
      if (index !== 0 || !bin) throw corrupted(`buffers[${index}] không có uri nhưng GLB thiếu chunk BIN`);
      if (entry.byteLength > bin.length) throw corrupted('buffers[0].byteLength lớn hơn chunk BIN');
      return entry.byteLength;
    }
    const match = typeof entry.uri === 'string' ? EMBEDDED_DATA_URI.exec(entry.uri) : null;
    if (!match) throw externalResource(`buffers[${index}].uri`);
    if (Buffer.from(match[1], 'base64').length < entry.byteLength) {
      throw corrupted(`Dữ liệu nhúng của buffers[${index}] ngắn hơn byteLength`);
    }
    return entry.byteLength;
  });
}

function validateBufferViews(document: JsonObject, bufferLengths: number[]): number {
  const views = optionalArray(document, 'bufferViews');
  views.forEach((entry, index) => {
    if (!isObject(entry) || !isNonNegativeInteger(entry.buffer) || entry.buffer >= bufferLengths.length) {
      throw corrupted(`bufferViews[${index}].buffer trỏ tới buffer không tồn tại`);
    }
    const byteOffset = entry.byteOffset ?? 0;
    if (!isNonNegativeInteger(byteOffset) || !isNonNegativeInteger(entry.byteLength) || entry.byteLength < 1) {
      throw corrupted(`bufferViews[${index}] có byteOffset/byteLength không hợp lệ`);
    }
    if (byteOffset + entry.byteLength > bufferLengths[entry.buffer]) {
      throw corrupted(`bufferViews[${index}] vượt quá kích thước buffer`);
    }
  });
  return views.length;
}

function validateViewReference(value: unknown, viewCount: number, path: string): void {
  if (value === undefined) return;
  if (!isNonNegativeInteger(value) || value >= viewCount) {
    throw corrupted(`${path} trỏ tới bufferView không tồn tại`);
  }
}

/** Nội dung glTF: asset 2.x, buffer/bufferView/accessor/image hợp lệ và không có tài nguyên ngoài. */
function validateDocument(document: JsonObject, bin: Buffer | null): void {
  const asset = document.asset;
  if (!isObject(asset) || typeof asset.version !== 'string' || !/^2\.\d+$/.test(asset.version)) {
    throw corrupted('GLB thiếu asset.version 2.x');
  }
  const viewCount = validateBufferViews(document, validateBuffers(document, bin));

  optionalArray(document, 'accessors').forEach((entry, index) => {
    if (!isObject(entry)) throw corrupted(`accessors[${index}] không hợp lệ`);
    validateViewReference(entry.bufferView, viewCount, `accessors[${index}].bufferView`);
  });

  optionalArray(document, 'images').forEach((entry, index) => {
    if (!isObject(entry)) throw corrupted(`images[${index}] không hợp lệ`);
    if (entry.uri !== undefined) {
      if (typeof entry.uri !== 'string' || !EMBEDDED_DATA_URI.test(entry.uri)) {
        throw externalResource(`images[${index}].uri`);
      }
      return;
    }
    if (entry.bufferView === undefined) throw corrupted(`images[${index}] thiếu cả uri lẫn bufferView`);
    validateViewReference(entry.bufferView, viewCount, `images[${index}].bufferView`);
  });
}

/**
 * Kiểm tra GLB (glTF 2.0 binary): header, độ dài khai báo, chunk JSON đầu tiên parse được,
 * chunk BIN tùy chọn và mọi tài nguyên (buffer, image) phải được nhúng trong file.
 */
export function validateGlb(buffer: Buffer): void {
  if (buffer.length < HEADER_LENGTH + 8) throw corrupted('File GLB quá ngắn');
  const version = buffer.readUInt32LE(4);
  if (version !== 2) throw corrupted(`Chỉ hỗ trợ glTF 2.0 (GLB version ${version})`);
  if (buffer.readUInt32LE(8) !== buffer.length) {
    throw corrupted('Độ dài khai báo trong header GLB không khớp kích thước file');
  }

  let offset = HEADER_LENGTH;
  let index = 0;
  let document: JsonObject | null = null;
  let bin: Buffer | null = null;

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) throw corrupted('Chunk GLB bị cắt cụt');
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    if (end > buffer.length) throw corrupted('Chunk GLB vượt quá kích thước file');
    if (length % 4 !== 0) throw corrupted('Chunk GLB không căn lề 4 byte');
    const data = buffer.subarray(offset + 8, end);

    if (index === 0) {
      if (type !== CHUNK_JSON) throw corrupted('Chunk đầu tiên của GLB phải là JSON');
      document = parseJsonChunk(data);
    } else if (index === 1 && type === CHUNK_BIN) {
      bin = data;
    } else if (type === CHUNK_JSON || type === CHUNK_BIN) {
      throw corrupted('GLB chứa chunk JSON/BIN sai vị trí hoặc trùng lặp');
    }
    // Chunk loại khác: spec yêu cầu bỏ qua.
    offset = end;
    index++;
  }

  if (!document) throw corrupted('GLB thiếu chunk JSON');
  validateDocument(document, bin);
}
