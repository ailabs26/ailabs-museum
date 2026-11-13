import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MediaKind } from '../entities/media.entity';
import {
  MAX_UPLOAD_BYTES,
  MEDIA_FORMAT_SPECS,
  MEGABYTE,
  MediaFormat,
} from '../inspection/media-formats';
import { detectMediaFormat, isMp3FrameSync, looksLikeMarkup } from '../inspection/media-signature';
import {
  EXE_FILE,
  SVG_FILE,
  buildGlb,
  buildJpeg,
  buildMp3,
  buildPng,
  buildVtt,
  buildWebp,
} from './media-test-files';

const ascii = (text: string) => Buffer.from(text, 'latin1');

describe('Media formats — giới hạn Mục 5.2 SRS', () => {
  it('MB = 1.000.000 byte (không phải 1.048.576)', () => {
    assert.equal(MEGABYTE, 1_000_000);
  });

  const expected: Array<[MediaFormat, MediaKind, string, number]> = [
    [MediaFormat.GLB, MediaKind.MODEL, 'model/gltf-binary', 10_000_000],
    [MediaFormat.JPEG, MediaKind.IMAGE, 'image/jpeg', 2_000_000],
    [MediaFormat.PNG, MediaKind.IMAGE, 'image/png', 2_000_000],
    [MediaFormat.WEBP, MediaKind.IMAGE, 'image/webp', 2_000_000],
    [MediaFormat.MP3, MediaKind.AUDIO, 'audio/mpeg', 10_000_000],
    [MediaFormat.VTT, MediaKind.SUBTITLE, 'text/vtt', 1_000_000],
  ];
  for (const [format, kind, mime, max] of expected) {
    it(`${format}: kind=${kind}, mime=${mime}, tối đa ${max} byte`, () => {
      const spec = MEDIA_FORMAT_SPECS[format];
      assert.equal(spec.format, format);
      assert.equal(spec.kind, kind);
      assert.equal(spec.mimeType, mime);
      assert.equal(spec.maxBytes, max);
      assert.match(spec.extension, /^[a-z0-9]+$/);
    });
  }

  it('chỉ có đúng 6 định dạng — không có SVG', () => {
    assert.deepEqual(Object.keys(MEDIA_FORMAT_SPECS).sort(), ['glb', 'jpeg', 'mp3', 'png', 'vtt', 'webp']);
    const mimes = Object.values(MEDIA_FORMAT_SPECS).map((spec) => spec.mimeType);
    assert.ok(!mimes.some((mime) => mime.includes('svg')));
  });

  it('MAX_UPLOAD_BYTES bằng giới hạn lớn nhất (10 MB)', () => {
    assert.equal(MAX_UPLOAD_BYTES, 10 * MEGABYTE);
  });
});

describe('detectMediaFormat — nhận diện theo magic bytes', () => {
  it('PNG hợp lệ → png', () => assert.equal(detectMediaFormat(buildPng()), MediaFormat.PNG));
  it('JPEG hợp lệ → jpeg', () => assert.equal(detectMediaFormat(buildJpeg()), MediaFormat.JPEG));
  it('WebP lossless → webp', () => assert.equal(detectMediaFormat(buildWebp('lossless')), MediaFormat.WEBP));
  it('WebP lossy → webp', () => assert.equal(detectMediaFormat(buildWebp('lossy')), MediaFormat.WEBP));
  it('WebP extended → webp', () => assert.equal(detectMediaFormat(buildWebp('extended')), MediaFormat.WEBP));
  it('GLB → glb', () => assert.equal(detectMediaFormat(buildGlb()), MediaFormat.GLB));
  it('MP3 bắt đầu bằng ID3 → mp3', () => assert.equal(detectMediaFormat(buildMp3({ withId3: true })), MediaFormat.MP3));
  it('MP3 bắt đầu bằng frame sync → mp3', () => assert.equal(detectMediaFormat(buildMp3()), MediaFormat.MP3));
  it('WebVTT → vtt', () => assert.equal(detectMediaFormat(buildVtt()), MediaFormat.VTT));
  it('WebVTT có UTF-8 BOM → vtt', () => {
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), buildVtt()]);
    assert.equal(detectMediaFormat(withBom), MediaFormat.VTT);
  });
  it('WebVTT chỉ gồm "WEBVTT" → vtt', () => assert.equal(detectMediaFormat(ascii('WEBVTT')), MediaFormat.VTT));
  it('"WEBVTT" kèm tiêu đề sau tab → vtt', () => assert.equal(detectMediaFormat(ascii('WEBVTT\tTitle\n')), MediaFormat.VTT));

  it('"WEBVTTX" (không có phân cách) → null', () => assert.equal(detectMediaFormat(ascii('WEBVTTX\n')), null));
  it('"webvtt" chữ thường → null', () => assert.equal(detectMediaFormat(ascii('webvtt\n')), null));
  it('RIFF nhưng là WAVE → null', () => assert.equal(detectMediaFormat(ascii('RIFF\x10\x00\x00\x00WAVEfmt ')), null));
  it('PNG cụt chữ ký 7 byte → null', () => assert.equal(detectMediaFormat(buildPng().subarray(0, 7)), null));
  it('chữ ký PNG sai 1 byte → null', () => {
    const bad = Buffer.from(buildPng());
    bad[4] = 0x00;
    assert.equal(detectMediaFormat(bad), null);
  });
  it('FF D8 không có FF thứ ba → null', () => assert.equal(detectMediaFormat(Buffer.from([0xff, 0xd8, 0x00, 0x00])), null));
  it('"gltf" chữ thường → null', () => assert.equal(detectMediaFormat(ascii('gltf\x02\x00\x00\x00')), null));
  it('file .exe (MZ) → null', () => assert.equal(detectMediaFormat(EXE_FILE), null));
  it('SVG → null', () => assert.equal(detectMediaFormat(SVG_FILE), null));
  it('HTML → null', () => assert.equal(detectMediaFormat(ascii('<!DOCTYPE html><html></html>')), null));
  it('PHP → null', () => assert.equal(detectMediaFormat(ascii('<?php echo 1; ?>')), null));
  it('JavaScript → null', () => assert.equal(detectMediaFormat(ascii('alert(document.cookie)')), null));
  it('PDF → null', () => assert.equal(detectMediaFormat(ascii('%PDF-1.7\n')), null));
  it('ZIP → null', () => assert.equal(detectMediaFormat(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0])), null));
  it('GIF → null (không thuộc danh sách cho phép)', () => assert.equal(detectMediaFormat(ascii('GIF89a\x01\x00')), null));
  it('buffer rỗng → null', () => assert.equal(detectMediaFormat(Buffer.alloc(0)), null));
  it('1 byte → null', () => assert.equal(detectMediaFormat(Buffer.from([0xff])), null));

  it('Content-Type/đuôi file không ảnh hưởng: chỉ nội dung quyết định', () => {
    // Hàm chỉ nhận buffer — không có tham số mime/filename để client tác động.
    assert.equal(detectMediaFormat.length, 1);
  });
});

describe('isMp3FrameSync', () => {
  it('FF FB (MPEG-1 Layer III) → true', () => assert.equal(isMp3FrameSync(Buffer.from([0xff, 0xfb]), 0), true));
  it('FF F3 (MPEG-2 Layer III) → true', () => assert.equal(isMp3FrameSync(Buffer.from([0xff, 0xf3]), 0), true));
  it('FF E3 (MPEG-2.5 Layer III) → true', () => assert.equal(isMp3FrameSync(Buffer.from([0xff, 0xe3]), 0), true));
  it('FF FD (Layer II) → false', () => assert.equal(isMp3FrameSync(Buffer.from([0xff, 0xfd]), 0), false));
  it('FF D8 (JPEG) → false', () => assert.equal(isMp3FrameSync(Buffer.from([0xff, 0xd8]), 0), false));
  it('offset vượt độ dài → false', () => assert.equal(isMp3FrameSync(Buffer.from([0xff]), 0), false));
  it('kiểm tra ở offset khác 0', () => assert.equal(isMp3FrameSync(Buffer.from([0x00, 0xff, 0xfb]), 1), true));
});

describe('looksLikeMarkup — nhận diện SVG/HTML/XML/script', () => {
  it('SVG có <?xml → true', () => assert.equal(looksLikeMarkup(SVG_FILE), true));
  it('SVG không có prolog → true', () => assert.equal(looksLikeMarkup(ascii('<svg onload="x()"/>')), true));
  it('SVG có khoảng trắng đầu → true', () => assert.equal(looksLikeMarkup(ascii('\n\t  <svg/>')), true));
  it('SVG có BOM → true', () => assert.equal(looksLikeMarkup(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), ascii('<svg/>')])), true));
  it('HTML → true', () => assert.equal(looksLikeMarkup(ascii('<html><body></body></html>')), true));
  it('PHP → true', () => assert.equal(looksLikeMarkup(ascii('<?php system($_GET["c"]); ?>')), true));
  it('<script> sau văn bản → true', () => assert.equal(looksLikeMarkup(ascii('hello <script>alert(1)</script>')), true));
  it('<SVG chữ hoa → true', () => assert.equal(looksLikeMarkup(ascii('junk <SVG>')), true));
  it('văn bản thuần → false', () => assert.equal(looksLikeMarkup(ascii('chỉ là văn bản')), false));
  it('file .exe → false', () => assert.equal(looksLikeMarkup(EXE_FILE), false));
  it('buffer rỗng → false', () => assert.equal(looksLikeMarkup(Buffer.alloc(0)), false));
});
