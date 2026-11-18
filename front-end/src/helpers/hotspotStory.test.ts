import { describe, expect, it } from 'vitest';
import { resolveHotspotStory } from './hotspotStory';
import type { MuseumDisplay } from '@/interfaces/museumScene';

const display: MuseumDisplay = { id: 'exhibit', roomId: 'room', title: 'Exhibit', description: '',
  position: [0, 0, 0], shape: 'cube', color: '#ffffff',
  hotspots: [{ id: 'a', label: 'A', body: 'First' }, { id: 'b', label: 'B', body: 'Second' }] };
const selection = { roomId: 'room', exhibitId: 'exhibit', hotspotId: 'a', issuedAt: 0 };

describe('story identity', () => {
  it('resolves only the hotspot of the selected exhibit and room', () => {
    expect(resolveHotspotStory(selection, display)?.hotspot.body).toBe('First');
    expect(resolveHotspotStory({ ...selection, hotspotId: 'b' }, display)?.index).toBe(1);
    expect(resolveHotspotStory(selection, undefined)).toBeNull();
    expect(resolveHotspotStory(selection, { ...display, id: 'another' })).toBeNull();
    expect(resolveHotspotStory(selection, { ...display, roomId: 'another' })).toBeNull();
  });

  it('uses refreshed content and does not resolve missing or synthetic annotations', () => {
    const updated = { ...display, hotspots: [{ id: 'a', label: 'Changed', body: 'New copy' }] };
    expect(resolveHotspotStory(selection, updated)?.hotspot.body).toBe('New copy');
    expect(resolveHotspotStory(selection, { ...display, hotspots: [] })).toBeNull();
    expect(resolveHotspotStory({ ...selection, hotspotId: 'exhibit:default' }, display)).toBeNull();
  });
});
