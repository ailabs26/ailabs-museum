const HEAP_LIMIT_BYTES = 128 * 1024 * 1024;

/** Limit the engine-owned memory of the installed Three 0.170 Draco WASM. */
export function limitDracoWasmMemory(binary: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(binary);
  let offset = 8;
  while (offset < bytes.length) {
    const sectionId = bytes[offset++];
    const lengthOffset = offset;
    let length = 0;
    let shift = 0;
    let byte: number;
    do {
      if (offset >= bytes.length || shift > 28) throw new Error('Draco WASM section không hợp lệ.');
      byte = bytes[offset++];
      length += (byte & 127) * 2 ** shift;
      shift += 7;
    } while (byte & 128);
    if (offset + length > bytes.length) throw new Error('Draco WASM section không hợp lệ.');
    if (sectionId === 5) {
      // Pinned decoder has one memory, initial 256 pages (16 MiB), maximum 32768 pages (2 GiB).
      const expected = [1, 1, 128, 2, 128, 128, 2];
      if (length !== expected.length || expected.some((value, index) => bytes[offset + index] !== value)) {
        throw new Error('Draco WASM memory layout chưa được kiểm chứng.');
      }
      // One memory, initial 256 pages, maximum 2048 pages (128 MiB), unsigned LEB128.
      const section = new Uint8Array([6, 1, 1, 128, 2, 128, 16]);
      const result = new Uint8Array(lengthOffset + section.length + bytes.length - offset - length);
      result.set(bytes.subarray(0, lengthOffset));
      result.set(section, lengthOffset);
      result.set(bytes.subarray(offset + length), lengthOffset + section.length);
      return result.buffer;
    }
    offset += length;
  }
  throw new Error('Draco WASM thiếu giới hạn memory đã kiểm chứng.');
}

interface DecoderModule {
  _malloc(bytes: number): number;
  Decoder: { prototype: Record<string, (...args: unknown[]) => unknown> };
}
interface DecoderConfig {
  wasmMemory?: { buffer: ArrayBuffer; grow(pages: number): number };
  onModuleLoaded(module: DecoderModule): void;
}
type DecoderFactory = (config: DecoderConfig) => unknown;

// Serialized into Three's existing worker after the bundled decoder factory.
// Keep this function self-contained, including its error messages and constants.
function installMemoryLimit(factory: DecoderFactory, jsFallback: boolean, limit: number): DecoderFactory {
  return config => {
    if (jsFallback) {
      config.wasmMemory = {
        buffer: new ArrayBuffer(limit),
        grow(pages) {
          if (pages === 0) return limit / 65536;
          throw new RangeError('Draco vượt giới hạn heap.');
        },
      };
    }
    const loaded = config.onModuleLoaded;
    config.onModuleLoaded = module => {
      let outputBytes = 0;
      const allocate = module._malloc.bind(module);
      module._malloc = bytes => {
        if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > limit - outputBytes) {
          throw new RangeError('Draco vượt giới hạn output.');
        }
        outputBytes += bytes;
        const pointer = allocate(bytes);
        if (bytes > 0 && pointer === 0) throw new RangeError('Draco vượt giới hạn heap.');
        return pointer;
      };
      for (const method of ['DecodeArrayToMesh', 'DecodeArrayToPointCloud']) {
        const decode = module.Decoder.prototype[method];
        module.Decoder.prototype[method] = function (...args) {
          outputBytes = 0;
          return decode.apply(this, args);
        };
      }
      loaded(module);
    };
    return factory(config);
  };
}

export function limitDracoDecoderSource(source: string, jsFallback: boolean): string {
  return `${source}\n;DracoDecoderModule = (${installMemoryLimit.toString()})(DracoDecoderModule, ${jsFallback}, ${HEAP_LIMIT_BYTES});\n`;
}
