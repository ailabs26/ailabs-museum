import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deflateSync } from 'node:zlib';
import { MediaErrorCode, MediaFormatError } from '../inspection/media-format.error';
import { MediaFormat } from '../inspection/media-formats';
import { validateMediaStructure } from '../inspection/media-structure';
import { readMp3FrameHeader } from '../inspection/validators/mp3.validator';
import {
  MP3_FRAME_LENGTH,
  PNG_SIGNATURE,
  buildGlb,
  buildJpeg,
  buildMp3,
  buildPng,
  buildVtt,
  buildWebp,
  defaultGltfJson,
  id3Tag,
  mp3Frame,
  pngChunk,
  vp8Chunk,
  vp8lChunk,
  vp8xChunk,
  wrapRiffWebp,
} from './media-test-files';

function passes(format: MediaFormat, buffer: Buffer): void {
  assert.doesNotThrow(() => validateMediaStructure(format, buffer));
}

function rejects(format: MediaFormat, buffer: Buffer, messagePattern?: RegExp, code = MediaErrorCode.CORRUPTED): void {
  assert.throws(
    () => validateMediaStructure(format, buffer),
    (error: unknown) => {
      assert.ok(error instanceof MediaFormatError, `phải là MediaFormatError, nhận: ${String(error)}`);
      assert.equal(error.code, code);
      if (messagePattern) assert.match(error.message, messagePattern);
      return true;
    },
  );
}

const vtt = (...lines: string[]) => buildVtt(lines.join('\n'));

// ===================================================================== PNG
describe('PNG — kiểm tra cấu trúc và giải nén', () => {
  it('RGBA 8-bit hợp lệ', () => passes(MediaFormat.PNG, buildPng()));
  it('grayscale 1-bit hợp lệ', () => passes(MediaFormat.PNG, buildPng({ colorType: 0, bitDepth: 1, width: 9 })));
  it('RGB 16-bit hợp lệ', () => passes(MediaFormat.PNG, buildPng({ colorType: 2, bitDepth: 16 })));
  it('gray+alpha hợp lệ', () => passes(MediaFormat.PNG, buildPng({ colorType: 4 })));
  it('palette kèm PLTE hợp lệ', () =>
    passes(MediaFormat.PNG, buildPng({ colorType: 3, bitDepth: 8, extraChunks: [pngChunk('PLTE', Buffer.alloc(6))] })));
  it('ảnh 1×1 hợp lệ', () => passes(MediaFormat.PNG, buildPng({ width: 1, height: 1 })));
  it('chunk phụ (tEXt) hợp lệ được bỏ qua', () =>
    passes(MediaFormat.PNG, buildPng({ extraChunks: [pngChunk('tEXt', Buffer.from('Title\0Museum'))] })));
  it('interlace Adam7 hợp lệ', () => {
    // 3×3 RGBA interlaced: các lượt có pixel là 1,3,5,6,7 (lượt 2 và 4 rỗng).
    const passes7 = [
      [1, 1],
      [0, 0],
      [1, 1],
      [0, 0],
      [2, 1],
      [1, 2],
      [3, 1],
    ];
    const raw = Buffer.concat(
      passes7.filter(([w, h]) => w > 0 && h > 0).map(([w, h]) => Buffer.alloc(h * (1 + w * 4), 0)),
    );
    passes(MediaFormat.PNG, buildPng({ width: 3, height: 3, interlace: 1, idat: deflateSync(raw) }));
  });
  it('dữ liệu thừa sau IEND được bỏ qua', () =>
    passes(MediaFormat.PNG, Buffer.concat([buildPng(), Buffer.from('trailing')])));

  it('chỉ có chữ ký → thiếu IHDR', () => rejects(MediaFormat.PNG, PNG_SIGNATURE, /thiếu chunk IHDR/));
  it('CRC sai → từ chối', () => {
    const bad = Buffer.from(buildPng());
    bad[29] ^= 0xff; // byte CRC của IHDR (8 + 4 + 4 + 13)
    rejects(MediaFormat.PNG, bad, /CRC/);
  });
  it('nội dung IHDR bị sửa (CRC không còn khớp) → từ chối', () => {
    const bad = Buffer.from(buildPng());
    bad[16] ^= 0x01;
    rejects(MediaFormat.PNG, bad, /CRC/);
  });
  it('chunk đầu không phải IHDR → từ chối', () => {
    const bad = Buffer.concat([PNG_SIGNATURE, pngChunk('tEXt', Buffer.from('a\0b')), buildPng().subarray(8)]);
    rejects(MediaFormat.PNG, bad, /IHDR/);
  });
  it('thiếu IEND → từ chối', () => rejects(MediaFormat.PNG, buildPng({ omitIend: true }), /IEND/));
  it('thiếu IDAT → từ chối', () => {
    const ihdr = buildPng().subarray(8, 8 + 25);
    rejects(MediaFormat.PNG, Buffer.concat([PNG_SIGNATURE, ihdr, pngChunk('IEND', Buffer.alloc(0))]), /IDAT/);
  });
  it('IDAT không phải zlib → từ chối', () =>
    rejects(MediaFormat.PNG, buildPng({ idat: Buffer.from('not zlib data') }), /giải nén/));
  it('IDAT giải nén ra thiếu byte → từ chối', () =>
    rejects(MediaFormat.PNG, buildPng({ idat: deflateSync(Buffer.alloc(5)) }), /không khớp/));
  it('IDAT giải nén ra thừa byte → từ chối', () =>
    rejects(MediaFormat.PNG, buildPng({ width: 1, height: 1, idat: deflateSync(Buffer.alloc(100)) })));
  it('byte filter dòng quét > 4 → từ chối', () => {
    const raw = Buffer.alloc(1 + 4, 0);
    raw[0] = 9;
    rejects(MediaFormat.PNG, buildPng({ width: 1, height: 1, idat: deflateSync(raw) }), /filter/);
  });
  it('width = 0 → từ chối', () => rejects(MediaFormat.PNG, buildPng({ width: 0 }), /lớn hơn 0/));
  it('height = 0 → từ chối', () => rejects(MediaFormat.PNG, buildPng({ height: 0 }), /lớn hơn 0/));
  it('ảnh 100000×100000 (decompression bomb) → từ chối trước khi giải nén', () =>
    rejects(MediaFormat.PNG, buildPng({ width: 100_000, height: 100_000, idat: Buffer.alloc(4) }), /vượt quá/));
  it('8193 pixel chiều ngang → từ chối', () => rejects(MediaFormat.PNG, buildPng({ width: 8193, height: 1, idat: Buffer.alloc(4) })));
  it('color type không tồn tại (5) → từ chối', () => rejects(MediaFormat.PNG, buildPng({ colorType: 5 }), /color type/));
  it('bit depth sai cho RGB (4) → từ chối', () => rejects(MediaFormat.PNG, buildPng({ colorType: 2, bitDepth: 4 })));
  it('interlace = 2 → từ chối', () => rejects(MediaFormat.PNG, buildPng({ interlace: 2 }), /interlace/));
  it('palette thiếu PLTE → từ chối', () => rejects(MediaFormat.PNG, buildPng({ colorType: 3 }), /PLTE/));
  it('PLTE độ dài không chia hết cho 3 → từ chối', () =>
    rejects(MediaFormat.PNG, buildPng({ colorType: 3, extraChunks: [pngChunk('PLTE', Buffer.alloc(4))] }), /PLTE/));
  it('chunk bắt buộc lạ (ABCD) → từ chối', () =>
    rejects(MediaFormat.PNG, buildPng({ extraChunks: [pngChunk('ABCD', Buffer.alloc(1))] }), /không xác định/));
  it('tên chunk chứa ký tự không phải chữ → từ chối', () =>
    rejects(MediaFormat.PNG, buildPng({ extraChunks: [pngChunk('a1b2', Buffer.alloc(1))] }), /Tên chunk/));
  it('hai chunk IHDR → từ chối', () => {
    const png = buildPng();
    const ihdr = png.subarray(8, 33);
    rejects(MediaFormat.PNG, Buffer.concat([PNG_SIGNATURE, ihdr, ihdr, png.subarray(33)]), /nhiều chunk IHDR/);
  });
  it('độ dài chunk khai báo vượt file → từ chối', () => {
    const bad = Buffer.from(buildPng());
    bad.writeUInt32BE(0x7ffffff0, 8);
    rejects(MediaFormat.PNG, bad, /cắt cụt/);
  });
});

// ===================================================================== JPEG
describe('JPEG — kiểm tra chuỗi segment', () => {
  it('baseline hợp lệ', () => passes(MediaFormat.JPEG, buildJpeg()));
  it('progressive (SOF2) hợp lệ', () => passes(MediaFormat.JPEG, buildJpeg({ sofMarker: 0xc2 })));
  it('dữ liệu thừa sau EOI được bỏ qua', () =>
    passes(MediaFormat.JPEG, buildJpeg({ trailing: Buffer.from('extra') })));
  it('byte đệm 0xFF trước marker hợp lệ', () => {
    const jpeg = buildJpeg();
    passes(MediaFormat.JPEG, Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xff]), jpeg.subarray(2)]));
  });

  it('chỉ có SOI → từ chối', () => rejects(MediaFormat.JPEG, Buffer.from([0xff, 0xd8, 0xff]), /đột ngột/));
  it('thiếu EOI → từ chối', () => rejects(MediaFormat.JPEG, buildJpeg({ omitEoi: true }), /EOI/));
  it('thiếu SOF → từ chối (SOS trước SOF)', () => rejects(MediaFormat.JPEG, buildJpeg({ omitSof: true }), /SOF/));
  it('SOI + EOI không có ảnh → từ chối', () =>
    rejects(MediaFormat.JPEG, Buffer.from([0xff, 0xd8, 0xff, 0xd9]), /không chứa dữ liệu ảnh/));
  it('width = 0 → từ chối', () => rejects(MediaFormat.JPEG, buildJpeg({ width: 0 }), /lớn hơn 0/));
  it('height = 0 → từ chối', () => rejects(MediaFormat.JPEG, buildJpeg({ height: 0 }), /lớn hơn 0/));
  it('ảnh 60000×60000 → từ chối', () => rejects(MediaFormat.JPEG, buildJpeg({ width: 60_000, height: 60_000 }), /vượt quá/));
  it('độ chính xác mẫu 7 bit → từ chối', () => {
    const bad = Buffer.from(buildJpeg());
    const sofAt = bad.indexOf(Buffer.from([0xff, 0xc0]));
    bad[sofAt + 4] = 7;
    rejects(MediaFormat.JPEG, bad, /chính xác/);
  });
  it('số thành phần màu = 0 → từ chối', () => {
    const bad = Buffer.from(buildJpeg());
    const sofAt = bad.indexOf(Buffer.from([0xff, 0xc0]));
    bad[sofAt + 9] = 0;
    rejects(MediaFormat.JPEG, bad, /thành phần/);
  });
  it('hai SOF → từ chối', () => {
    const jpeg = buildJpeg();
    const sofAt = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
    const sof = jpeg.subarray(sofAt, sofAt + 13);
    rejects(MediaFormat.JPEG, Buffer.concat([jpeg.subarray(0, sofAt), sof, jpeg.subarray(sofAt)]), /nhiều header/);
  });
  it('byte rác thay vì marker → từ chối', () => {
    const bad = Buffer.from(buildJpeg());
    bad[2] = 0x00;
    rejects(MediaFormat.JPEG, bad, /marker/);
  });
  it('độ dài segment < 2 → từ chối', () => {
    const bad = Buffer.from(buildJpeg());
    bad.writeUInt16BE(1, 4);
    rejects(MediaFormat.JPEG, bad);
  });
  it('độ dài segment vượt file → từ chối', () => {
    const bad = Buffer.from(buildJpeg());
    bad.writeUInt16BE(0xfff0, 4);
    rejects(MediaFormat.JPEG, bad, /cắt cụt/);
  });
  it('header SOS sai độ dài → từ chối', () => {
    const bad = Buffer.from(buildJpeg());
    const sosAt = bad.indexOf(Buffer.from([0xff, 0xda]));
    bad[sosAt + 4] = 3; // khai 3 thành phần nhưng segment chỉ đủ cho 1
    rejects(MediaFormat.JPEG, bad, /SOS/);
  });
  it('SOI lặp lại giữa file → từ chối', () => {
    const jpeg = buildJpeg();
    rejects(MediaFormat.JPEG, Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xd8]), jpeg.subarray(2)]));
  });
});

// ===================================================================== WebP
describe('WebP — kiểm tra RIFF và bitstream header', () => {
  it('lossless (VP8L) hợp lệ', () => passes(MediaFormat.WEBP, buildWebp('lossless')));
  it('lossy (VP8) hợp lệ', () => passes(MediaFormat.WEBP, buildWebp('lossy')));
  it('extended (VP8X + VP8L) hợp lệ', () => passes(MediaFormat.WEBP, buildWebp('extended')));
  it('extended có metadata EXIF hợp lệ', () => {
    const exif = Buffer.concat([Buffer.from('EXIF', 'latin1'), Buffer.from([3, 0, 0, 0]), Buffer.from([1, 2, 3, 0])]);
    passes(MediaFormat.WEBP, wrapRiffWebp([vp8xChunk(), exif, vp8lChunk()]));
  });

  it('RIFF size lớn hơn file (cắt cụt) → từ chối', () =>
    rejects(MediaFormat.WEBP, wrapRiffWebp([vp8lChunk()], { riffSizeDelta: 100 }), /cắt cụt/));
  it('file quá ngắn → từ chối', () => rejects(MediaFormat.WEBP, Buffer.from('RIFF\x04\x00\x00\x00WEBP', 'latin1'), /quá ngắn/));
  it('chunk đầu là EXIF → từ chối', () => {
    const exif = Buffer.concat([Buffer.from('EXIF', 'latin1'), Buffer.from([2, 0, 0, 0, 1, 2])]);
    rejects(MediaFormat.WEBP, wrapRiffWebp([exif, vp8lChunk()]), /Chunk đầu tiên/);
  });
  it('VP8X không có dữ liệu ảnh → từ chối', () => rejects(MediaFormat.WEBP, wrapRiffWebp([vp8xChunk()]), /không chứa dữ liệu ảnh/));
  it('VP8X không đứng đầu → từ chối', () =>
    rejects(MediaFormat.WEBP, wrapRiffWebp([vp8lChunk(), vp8xChunk()]), /phải đứng đầu/));
  it('VP8L chữ ký sai → từ chối', () => rejects(MediaFormat.WEBP, wrapRiffWebp([vp8lChunk(4, 3, { badSignature: true })]), /Chữ ký VP8L/));
  it('VP8L version ≠ 0 → từ chối', () => rejects(MediaFormat.WEBP, wrapRiffWebp([vp8lChunk(4, 3, { version: 1 })]), /Phiên bản VP8L/));
  it('VP8 start code sai → từ chối', () => rejects(MediaFormat.WEBP, wrapRiffWebp([vp8Chunk(4, 3, { badStartCode: true })]), /Start code/));
  it('VP8 không phải key frame → từ chối', () => rejects(MediaFormat.WEBP, wrapRiffWebp([vp8Chunk(4, 3, { interFrame: true })]), /key frame/));
  it('VP8 width = 0 → từ chối', () => rejects(MediaFormat.WEBP, wrapRiffWebp([vp8Chunk(0, 3)]), /lớn hơn 0/));
  it('VP8 9000 pixel → từ chối', () => rejects(MediaFormat.WEBP, wrapRiffWebp([vp8Chunk(9000, 3)]), /vượt quá/));
  it('VP8L 16384 pixel → từ chối', () => rejects(MediaFormat.WEBP, wrapRiffWebp([vp8lChunk(16384, 3)]), /vượt quá/));
  it('canvas VP8X 9000 pixel → từ chối', () => rejects(MediaFormat.WEBP, wrapRiffWebp([vp8xChunk(9000, 3), vp8lChunk()]), /vượt quá/));
  it('chunk khai báo vượt RIFF → từ chối', () => {
    const bad = Buffer.from(buildWebp('lossless'));
    bad.writeUInt32LE(5000, 16);
    rejects(MediaFormat.WEBP, bad, /vượt quá kích thước/);
  });
  it('VP8 partition vượt dữ liệu → từ chối', () => {
    const bad = Buffer.from(buildWebp('lossy'));
    bad[20] = 0xf0; // frame tag: partition size rất lớn, vẫn là key frame
    rejects(MediaFormat.WEBP, bad, /Partition/);
  });
});

// ===================================================================== MP3
describe('MP3 — kiểm tra khung MPEG Layer III', () => {
  it('chuỗi khung không có ID3 hợp lệ', () => passes(MediaFormat.MP3, buildMp3()));
  it('có thẻ ID3v2 hợp lệ', () => passes(MediaFormat.MP3, buildMp3({ withId3: true })));
  it('ID3v2 + đệm 0x00 trước khung đầu hợp lệ', () =>
    passes(MediaFormat.MP3, Buffer.concat([id3Tag(), Buffer.alloc(200, 0), buildMp3()])));
  it('kết thúc bằng thẻ ID3v1 (TAG) hợp lệ', () => {
    const tag = Buffer.concat([Buffer.from('TAG', 'latin1'), Buffer.alloc(125, 0)]);
    passes(MediaFormat.MP3, Buffer.concat([buildMp3({ frames: 2 }), tag]));
  });
  it('file ngắn gồm 1 khung trọn vẹn hợp lệ', () => passes(MediaFormat.MP3, buildMp3({ frames: 1 })));
  it('khung cuối bị cắt cụt nhưng đủ 3 khung đầu hợp lệ', () =>
    passes(MediaFormat.MP3, Buffer.concat([buildMp3({ frames: 3 }), mp3Frame().subarray(0, 100)])));
  it('MPEG-2 Layer III (22.05 kHz, 80 kbps) hợp lệ', () => {
    const header = Buffer.from([0xff, 0xf3, 0x90, 0x00]);
    const length = readMp3FrameHeader(header, 0)?.length ?? 0;
    assert.equal(length, 261); // bảng MPEG-2: chỉ số 9 = 80 kbps → ⌊72 × 80000 / 22050⌋
    passes(MediaFormat.MP3, Buffer.concat([mp3Frame(header, length), mp3Frame(header, length), mp3Frame(header, length)]));
  });

  it('chỉ có thẻ ID3, không có âm thanh → từ chối', () => rejects(MediaFormat.MP3, id3Tag(), /chỉ có thẻ ID3/));
  it('ID3 + dữ liệu rác → từ chối', () =>
    rejects(MediaFormat.MP3, Buffer.concat([id3Tag(), Buffer.from('not audio at all')]), /khung âm thanh/));
  it('ID3 header cụt → từ chối', () => rejects(MediaFormat.MP3, Buffer.from('ID3\x04', 'latin1'), /ID3/));
  it('ID3 version 5 → từ chối', () => {
    const bad = Buffer.from(buildMp3({ withId3: true }));
    bad[3] = 5;
    rejects(MediaFormat.MP3, bad, /ID3/);
  });
  it('kích thước ID3 không phải syncsafe → từ chối', () => {
    const bad = Buffer.from(buildMp3({ withId3: true }));
    bad[9] = 0x80;
    rejects(MediaFormat.MP3, bad, /ID3/);
  });
  it('2 khung rồi rác → từ chối', () =>
    rejects(MediaFormat.MP3, Buffer.concat([buildMp3({ frames: 2 }), Buffer.alloc(500, 0x41)])));
  it('khung đơn bị cắt cụt → từ chối', () => rejects(MediaFormat.MP3, mp3Frame().subarray(0, 200)));
  it('bitrate index 15 → từ chối', () => rejects(MediaFormat.MP3, Buffer.concat([mp3Frame(Buffer.from([0xff, 0xfb, 0xf0, 0x00])), buildMp3()])));
  it('free format (bitrate index 0) → từ chối', () =>
    rejects(MediaFormat.MP3, Buffer.concat([mp3Frame(Buffer.from([0xff, 0xfb, 0x00, 0x00])), buildMp3()])));
  it('sample rate index 3 → từ chối', () =>
    rejects(MediaFormat.MP3, Buffer.concat([mp3Frame(Buffer.from([0xff, 0xfb, 0x9c, 0x00])), buildMp3()])));
  it('version reserved (01) → từ chối', () =>
    rejects(MediaFormat.MP3, Buffer.concat([mp3Frame(Buffer.from([0xff, 0xeb, 0x90, 0x00])), buildMp3()])));
  it('đổi sample rate giữa chừng → từ chối', () => {
    const other = Buffer.from([0xff, 0xfb, 0x94, 0x00]); // 48 kHz
    rejects(MediaFormat.MP3, Buffer.concat([mp3Frame(), mp3Frame(other, 384), Buffer.alloc(10)]));
  });
  it('readMp3FrameHeader: tính đúng độ dài khung có padding', () => {
    assert.equal(readMp3FrameHeader(Buffer.from([0xff, 0xfb, 0x92, 0x00]), 0)?.length, MP3_FRAME_LENGTH + 1);
  });
});

// ===================================================================== GLB
describe('GLB — kiểm tra glTF 2.0 binary', () => {
  it('JSON + BIN hợp lệ', () => passes(MediaFormat.GLB, buildGlb()));
  it('chỉ có JSON, không có buffer hợp lệ', () =>
    passes(MediaFormat.GLB, buildGlb({ json: { asset: { version: '2.0' } }, bin: null })));
  it('buffer nhúng dạng data URI hợp lệ', () => {
    const json = { asset: { version: '2.0' }, buffers: [{ byteLength: 3, uri: 'data:application/octet-stream;base64,AQID' }] };
    passes(MediaFormat.GLB, buildGlb({ json, bin: null }));
  });
  it('ảnh nhúng qua bufferView hợp lệ', () => {
    const json = { ...defaultGltfJson(12), images: [{ bufferView: 0, mimeType: 'image/png' }] };
    passes(MediaFormat.GLB, buildGlb({ json }));
  });
  it('ảnh nhúng dạng data URI hợp lệ', () => {
    const json = { ...defaultGltfJson(12), images: [{ uri: 'data:image/png;base64,iVBORw0KGgo=' }] };
    passes(MediaFormat.GLB, buildGlb({ json }));
  });
  it('chunk loại lạ phía sau được bỏ qua', () => {
    const glb = buildGlb();
    const extra = Buffer.concat([Buffer.from([4, 0, 0, 0]), Buffer.from('XTRA', 'latin1'), Buffer.alloc(4)]);
    const merged = Buffer.concat([glb, extra]);
    merged.writeUInt32LE(merged.length, 8);
    passes(MediaFormat.GLB, merged);
  });

  it('version 1 → từ chối', () => rejects(MediaFormat.GLB, buildGlb({ version: 1 }), /glTF 2.0/));
  it('độ dài header không khớp file → từ chối', () => rejects(MediaFormat.GLB, buildGlb({ lengthDelta: 4 }), /không khớp/));
  it('file cụt chỉ có header → từ chối', () => rejects(MediaFormat.GLB, buildGlb().subarray(0, 12), /quá ngắn/));
  it('chunk đầu không phải JSON → từ chối', () => rejects(MediaFormat.GLB, buildGlb({ jsonChunkType: 0x004e4942 }), /phải là JSON/));
  it('JSON hỏng (magic đúng, nội dung lỗi) → từ chối', () => rejects(MediaFormat.GLB, buildGlb({ json: '{"asset": {', bin: null }), /parse/));
  it('JSON là mảng → từ chối', () => rejects(MediaFormat.GLB, buildGlb({ json: '[1,2]', bin: null }), /object/));
  it('JSON không phải UTF-8 → từ chối', () => {
    const glb = buildGlb({ json: '{"a":"xx"}', bin: null });
    glb[20 + 6] = 0xff;
    rejects(MediaFormat.GLB, glb, /UTF-8/);
  });
  it('thiếu asset.version → từ chối', () => rejects(MediaFormat.GLB, buildGlb({ json: { asset: {} }, bin: null }), /asset.version/));
  it('asset.version 1.0 → từ chối', () =>
    rejects(MediaFormat.GLB, buildGlb({ json: { asset: { version: '1.0' } }, bin: null }), /asset.version/));
  it('buffer trỏ file .bin bên ngoài → từ chối (tài nguyên ngoài)', () => {
    const json = { asset: { version: '2.0' }, buffers: [{ byteLength: 12, uri: 'model.bin' }] };
    rejects(MediaFormat.GLB, buildGlb({ json, bin: null }), /bên ngoài/, MediaErrorCode.EXTERNAL_RESOURCE);
  });
  it('buffer trỏ URL http → từ chối (tài nguyên ngoài)', () => {
    const json = { asset: { version: '2.0' }, buffers: [{ byteLength: 12, uri: 'https://evil.example/x.bin' }] };
    rejects(MediaFormat.GLB, buildGlb({ json, bin: null }), /bên ngoài/, MediaErrorCode.EXTERNAL_RESOURCE);
  });
  it('ảnh trỏ texture.png bên ngoài → từ chối (tài nguyên ngoài)', () => {
    const json = { ...defaultGltfJson(12), images: [{ uri: 'texture.png' }] };
    rejects(MediaFormat.GLB, buildGlb({ json }), /images\[0\]\.uri/, MediaErrorCode.EXTERNAL_RESOURCE);
  });
  it('data URI ngắn hơn byteLength → từ chối', () => {
    const json = { asset: { version: '2.0' }, buffers: [{ byteLength: 100, uri: 'data:application/octet-stream;base64,AQID' }] };
    rejects(MediaFormat.GLB, buildGlb({ json, bin: null }), /ngắn hơn/);
  });
  it('buffer không uri nhưng thiếu chunk BIN → từ chối', () =>
    rejects(MediaFormat.GLB, buildGlb({ json: defaultGltfJson(12), bin: null }), /thiếu chunk BIN/));
  it('byteLength lớn hơn chunk BIN → từ chối', () =>
    rejects(MediaFormat.GLB, buildGlb({ json: defaultGltfJson(64), bin: Buffer.alloc(12) }), /lớn hơn chunk BIN/));
  it('bufferView vượt buffer → từ chối', () => {
    const json = { ...defaultGltfJson(12), bufferViews: [{ buffer: 0, byteOffset: 8, byteLength: 8 }] };
    rejects(MediaFormat.GLB, buildGlb({ json }), /vượt quá kích thước buffer/);
  });
  it('bufferView trỏ buffer không tồn tại → từ chối', () => {
    const json = { ...defaultGltfJson(12), bufferViews: [{ buffer: 3, byteLength: 4 }] };
    rejects(MediaFormat.GLB, buildGlb({ json }), /không tồn tại/);
  });
  it('accessor trỏ bufferView không tồn tại → từ chối', () => {
    const json = { ...defaultGltfJson(12), accessors: [{ bufferView: 9, componentType: 5126, count: 1, type: 'VEC3' }] };
    rejects(MediaFormat.GLB, buildGlb({ json }), /accessors\[0\]/);
  });
  it('"buffers" không phải mảng → từ chối', () =>
    rejects(MediaFormat.GLB, buildGlb({ json: { asset: { version: '2.0' }, buffers: {} }, bin: null }), /phải là mảng/));
  it('chunk không căn lề 4 byte → từ chối', () => {
    const glb = Buffer.from(buildGlb());
    glb.writeUInt32LE(glb.readUInt32LE(12) - 1, 12);
    rejects(MediaFormat.GLB, glb);
  });
  it('chunk JSON trùng lặp → từ chối', () => {
    const glb = buildGlb({ bin: null, json: { asset: { version: '2.0' } } });
    const jsonChunk = glb.subarray(12);
    const merged = Buffer.concat([glb, jsonChunk]);
    merged.writeUInt32LE(merged.length, 8);
    rejects(MediaFormat.GLB, merged, /trùng lặp/);
  });
});

// ===================================================================== WebVTT
describe('WebVTT — kiểm tra timestamp và thứ tự cue', () => {
  it('phụ đề chuẩn có identifier và cue setting hợp lệ', () => passes(MediaFormat.VTT, buildVtt()));
  it('xuống dòng CRLF hợp lệ', () => passes(MediaFormat.VTT, Buffer.from('WEBVTT\r\n\r\n00:00.000 --> 00:01.000\r\nA\r\n')));
  it('timestamp không có giờ (mm:ss.ttt) hợp lệ', () => passes(MediaFormat.VTT, vtt('WEBVTT', '', '00:01.000 --> 00:02.000', 'A')));
  it('giờ 3 chữ số hợp lệ', () => passes(MediaFormat.VTT, vtt('WEBVTT', '', '100:00:00.000 --> 100:00:01.000', 'A')));
  it('cue cùng thời điểm bắt đầu hợp lệ', () =>
    passes(MediaFormat.VTT, vtt('WEBVTT', '', '00:01.000 --> 00:02.000', 'A', '', '00:01.000 --> 00:03.000', 'B')));
  it('NOTE và STYLE trước cue hợp lệ', () =>
    passes(MediaFormat.VTT, vtt('WEBVTT - Tiêu đề', '', 'STYLE', '::cue { color: red }', '', 'NOTE ghi chú', '', '00:01.000 --> 00:02.000', 'A')));
  it('UTF-8 BOM hợp lệ', () => passes(MediaFormat.VTT, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), buildVtt()])));
  it('nội dung tiếng Việt có dấu hợp lệ', () => passes(MediaFormat.VTT, vtt('WEBVTT', '', '00:00.000 --> 00:01.000', 'Bảo tàng Lịch sử Quân sự Việt Nam')));

  it('không có cue → từ chối', () => rejects(MediaFormat.VTT, vtt('WEBVTT', ''), /không có cue/));
  it('dòng đầu không phải WEBVTT → từ chối', () => rejects(MediaFormat.VTT, vtt('WEBVTTX', '', '00:01.000 --> 00:02.000', 'A'), /WEBVTT/));
  it('thiếu dòng trống sau header → từ chối', () => rejects(MediaFormat.VTT, vtt('WEBVTT', '00:01.000 --> 00:02.000', 'A'), /dòng trống/));
  it('kết thúc bằng bắt đầu → từ chối', () => rejects(MediaFormat.VTT, vtt('WEBVTT', '', '00:02.000 --> 00:02.000', 'A'), /kết thúc phải sau/));
  it('kết thúc trước bắt đầu → từ chối', () => rejects(MediaFormat.VTT, vtt('WEBVTT', '', '00:05.000 --> 00:02.000', 'A'), /kết thúc phải sau/));
  it('cue sai thứ tự → từ chối', () =>
    rejects(MediaFormat.VTT, vtt('WEBVTT', '', '00:05.000 --> 00:06.000', 'A', '', '00:01.000 --> 00:02.000', 'B'), /thứ tự/));
  it('dùng dấu phẩy thay dấu chấm (kiểu SRT) → từ chối', () =>
    rejects(MediaFormat.VTT, vtt('WEBVTT', '', '00:00:01,000 --> 00:00:02,000', 'A'), /timestamp/));
  it('phút = 60 → từ chối', () => rejects(MediaFormat.VTT, vtt('WEBVTT', '', '00:60.000 --> 01:00.000', 'A'), /timestamp/));
  it('giờ 1 chữ số → từ chối', () => rejects(MediaFormat.VTT, vtt('WEBVTT', '', '1:00:00.000 --> 1:00:01.000', 'A'), /timestamp/));
  it('mili-giây 2 chữ số → từ chối', () => rejects(MediaFormat.VTT, vtt('WEBVTT', '', '00:01.00 --> 00:02.000', 'A'), /timestamp/));
  it('thiếu khoảng trắng quanh --> → từ chối', () => rejects(MediaFormat.VTT, vtt('WEBVTT', '', '00:01.000-->00:02.000', 'A'), /timestamp/));
  it('cue chỉ có identifier, thiếu dòng thời gian → từ chối', () =>
    rejects(MediaFormat.VTT, vtt('WEBVTT', '', 'cue-1', 'Nội dung'), /thiếu dòng thời gian/));
  it('nội dung cue chứa --> → từ chối', () =>
    rejects(MediaFormat.VTT, vtt('WEBVTT', '', '00:01.000 --> 00:02.000', 'a --> b'), /không được chứa/));
  it('STYLE sau cue → từ chối', () =>
    rejects(MediaFormat.VTT, vtt('WEBVTT', '', '00:01.000 --> 00:02.000', 'A', '', 'STYLE', '::cue {}'), /STYLE/));
  it('NOTE chứa --> → từ chối', () => rejects(MediaFormat.VTT, vtt('WEBVTT', '', 'NOTE a --> b', '', '00:01.000 --> 00:02.000', 'A'), /NOTE/));
  it('UTF-8 không hợp lệ → từ chối', () =>
    rejects(MediaFormat.VTT, Buffer.concat([Buffer.from('WEBVTT\n\n00:01.000 --> 00:02.000\n'), Buffer.from([0xc3, 0x28])]), /UTF-8/));
  it('chứa ký tự NUL → từ chối', () => rejects(MediaFormat.VTT, vtt('WEBVTT', '', '00:01.000 --> 00:02.000', 'A\u0000B'), /NUL/));
});

// ===================================================================== Fuzz
/** PRNG xác định (mulberry32) để fuzz lặp lại được. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Chỉ được kết thúc êm hoặc ném MediaFormatError — không lỗi lạ (vd RangeError khi đọc quá biên). */
function assertControlledOutcome(format: MediaFormat, buffer: Buffer, label: string): void {
  try {
    validateMediaStructure(format, buffer);
  } catch (error) {
    assert.ok(error instanceof MediaFormatError, `${label}: lỗi không kiểm soát ${String(error)}`);
  }
}

describe('Fuzz — validator chỉ ném MediaFormatError', () => {
  const samples: Array<[MediaFormat, Buffer]> = [
    [MediaFormat.PNG, buildPng()],
    [MediaFormat.JPEG, buildJpeg()],
    [MediaFormat.WEBP, buildWebp('lossless')],
    [MediaFormat.WEBP, buildWebp('lossy')],
    [MediaFormat.WEBP, buildWebp('extended')],
    [MediaFormat.MP3, buildMp3({ withId3: true })],
    [MediaFormat.GLB, buildGlb()],
    [MediaFormat.VTT, buildVtt()],
  ];

  for (const [format, sample] of samples) {
    it(`${format} (${sample.length} byte): cắt cụt ở mọi độ dài`, () => {
      for (let length = 0; length < sample.length; length++) {
        assertControlledOutcome(format, sample.subarray(0, length), `cắt còn ${length} byte`);
      }
    });

    it(`${format}: 2000 lần lật byte ngẫu nhiên`, () => {
      const random = seededRandom(sample.length);
      for (let round = 0; round < 2000; round++) {
        const mutated = Buffer.from(sample);
        const flips = 1 + Math.floor(random() * 4);
        for (let flip = 0; flip < flips; flip++) {
          mutated[Math.floor(random() * mutated.length)] = Math.floor(random() * 256);
        }
        assertControlledOutcome(format, mutated, `vòng ${round}`);
      }
    });
  }
});
