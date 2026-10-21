import { describe, expect, it } from 'vitest';
import { firstTabWithError, mapExhibitErrors } from './exhibitFormErrors';

describe('mapExhibitErrors', () => {
  it('maps Submit Review gate errors onto the media tab fields', () => {
    const result = mapExhibitErrors([
      { field: 'imageId', code: 'media_rights_missing', message: 'Ảnh thiếu nguồn/tác giả/giấy phép' },
      { field: 'altText.vi', code: 'image_alt_text_missing', message: 'Thiếu alt text tiếng Việt' },
      { field: 'altText.en', code: 'image_alt_text_missing', message: 'Thiếu alt text tiếng Anh' },
      { field: 'subtitleEnId', code: 'audio_subtitle_missing', message: 'Audio tiếng Anh thiếu phụ đề' },
    ]);
    expect(result.fieldErrors).toEqual({
      imageId: 'Ảnh thiếu nguồn/tác giả/giấy phép',
      altTextVi: 'Thiếu alt text tiếng Việt',
      altTextEn: 'Thiếu alt text tiếng Anh',
      subtitleEnId: 'Audio tiếng Anh thiếu phụ đề',
    });
    expect(result.general).toEqual([]);
    expect(result.firstTab).toBe('media');
  });

  it('prefers the first tab in display order and maps content rule fields', () => {
    const result = mapExhibitErrors([
      { field: 'transcript.vi', code: 'audio_transcript_missing', message: 'Thiếu transcript' },
      { field: 'scale', code: 'publish_content_invalid', message: 'Scale phải > 0' },
      { field: 'name.en', code: 'publish_content_invalid', message: 'Thiếu tên tiếng Anh' },
    ]);
    expect(result.fieldErrors).toMatchObject({ transcriptVi: 'Thiếu transcript', scaleX: 'Scale phải > 0', nameEn: 'Thiếu tên tiếng Anh' });
    expect(result.firstTab).toBe('basic');
  });

  it('joins several errors on one field, keeps the legacy audioId alias and collects unknown fields', () => {
    const result = mapExhibitErrors([
      { field: 'audioId', code: 'media_not_ready', message: 'Audio chưa sẵn sàng' },
      { field: 'audioViId', code: 'media_rights_missing', message: 'Audio thiếu giấy phép' },
      { field: 'hotspots.0.label', code: 'publish_content_invalid', message: 'Thiếu nhãn' },
      { code: 'publish_content_invalid', message: 'Lỗi chung' },
    ]);
    expect(result.fieldErrors.audioViId).toBe('Audio chưa sẵn sàng; Audio thiếu giấy phép');
    expect(result.general).toEqual(['hotspots.0.label: Thiếu nhãn', 'Lỗi chung']);
  });

  it('maps publish-gate hotspot errors onto the hotspot fields of the right row', () => {
    const result = mapExhibitErrors([
      { field: 'hotspots[1].label.en', code: 'publish_content_invalid', message: 'Thiếu tiêu đề tiếng Anh' },
      { field: 'hotspots[0].body.vi', code: 'publish_content_invalid', message: 'Thiếu nội dung' },
      { field: 'hotspots[2].position', code: 'publish_content_invalid', message: 'Tọa độ không hợp lệ' },
    ]);
    expect(result.fieldErrors).toEqual({
      'hotspots.1.labelEn': 'Thiếu tiêu đề tiếng Anh',
      'hotspots.0.bodyVi': 'Thiếu nội dung',
      'hotspots.2.positionX': 'Tọa độ không hợp lệ',
    });
    expect(result.general).toEqual([]);
    expect(result.firstTab).toBe('hotspots');
  });

  it('returns no tab when nothing maps to a field', () => {
    expect(mapExhibitErrors([{ code: 'x', message: 'y' }]).firstTab).toBeNull();
  });

  it('finds the tab of client-side validation errors', () => {
    expect(firstTabWithError(['transcriptVi', 'roomId'])).toBe('basic');
    expect(firstTabWithError(['scaleY'])).toBe('transform');
    expect(firstTabWithError(['altTextEn'])).toBe('media');
    expect(firstTabWithError(['hotspots.0.labelVi'])).toBe('hotspots');
    expect(firstTabWithError(['hotspots.0.labelVi', 'altTextEn'])).toBe('media');
    expect(firstTabWithError([])).toBeNull();
  });
});
