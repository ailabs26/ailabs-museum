import { describe, expect, it } from 'vitest';
import {
  emptyHotspot,
  resolveHotspotText,
  toHotspotFormValues,
  toHotspotPayload,
  validateHotspots,
} from './exhibitHotspots';

describe('resolveHotspotText', () => {
  it('reads the bilingual JSON string stored in the hotspot column', () => {
    expect(resolveHotspotText('{"vi":"Mặt trống","en":"Drum face"}')).toEqual({ vi: 'Mặt trống', en: 'Drum face' });
  });

  it('accepts objects, legacy plain strings and invalid JSON-looking text', () => {
    expect(resolveHotspotText({ vi: 'A', en: 'B' })).toEqual({ vi: 'A', en: 'B' });
    expect(resolveHotspotText('Nhãn cũ')).toEqual({ vi: 'Nhãn cũ', en: '' });
    expect(resolveHotspotText('{không phải json}')).toEqual({ vi: '{không phải json}', en: '' });
    expect(resolveHotspotText(null)).toEqual({ vi: '', en: '' });
  });
});

describe('hotspot form conversion', () => {
  it('loads API hotspots in display order with numeric positions', () => {
    const values = toHotspotFormValues([
      { id: 'b', label: '{"vi":"Hai","en":"Two"}', body: '{"vi":"N2","en":"B2"}', position: { x: 1, y: 2, z: 3 }, displayOrder: 2 },
      { id: 'a', label: { vi: 'Một', en: 'One' }, body: 'Chỉ tiếng Việt', position: { x: 0, y: 0.5, z: 0 }, displayOrder: 1 },
    ]);
    expect(values.map((value) => value.labelVi)).toEqual(['Một', 'Hai']);
    expect(values[0]).toMatchObject({ bodyVi: 'Chỉ tiếng Việt', bodyEn: '', positionY: 0.5 });
    expect(values[1]).toMatchObject({ positionX: 1, positionY: 2, positionZ: 3 });
  });

  it('builds the payload with trimmed text and consecutive display order', () => {
    const payload = toHotspotPayload([
      { ...emptyHotspot(), labelVi: '  Mặt  ', labelEn: 'Face ', bodyVi: 'N', bodyEn: 'B', positionX: 0.2 },
      { ...emptyHotspot(), labelVi: 'Quai', labelEn: 'Handle', bodyVi: 'N', bodyEn: 'B' },
    ]);
    expect(payload[0]).toEqual({
      label: { vi: 'Mặt', en: 'Face' },
      body: { vi: 'N', en: 'B' },
      positionX: 0.2,
      positionY: 0,
      positionZ: 0,
      displayOrder: 1,
    });
    expect(payload[1].displayOrder).toBe(2);
  });
});

describe('validateHotspots', () => {
  it('requires both languages for title and body', () => {
    const errors = validateHotspots([{ ...emptyHotspot(), labelVi: 'Có', bodyEn: '   ' }]);
    expect(Object.keys(errors).sort()).toEqual([
      'hotspots.0.bodyEn',
      'hotspots.0.bodyVi',
      'hotspots.0.labelEn',
    ]);
  });

  it('enforces the publish-gate length limits and finite coordinates', () => {
    const errors = validateHotspots([
      { labelVi: 'x'.repeat(201), labelEn: 'ok', bodyVi: 'x'.repeat(5001), bodyEn: 'ok', positionX: Number.NaN, positionY: 0, positionZ: 0 },
    ]);
    expect(errors['hotspots.0.labelVi']).toMatch(/200/);
    expect(errors['hotspots.0.bodyVi']).toMatch(/5\.000/);
    expect(errors['hotspots.0.positionX']).toBeDefined();
    expect(errors['hotspots.0.labelEn']).toBeUndefined();
  });

  it('returns no errors for a complete hotspot', () => {
    expect(validateHotspots([{ ...emptyHotspot(), labelVi: 'A', labelEn: 'A', bodyVi: 'B', bodyEn: 'B' }])).toEqual({});
  });
});
