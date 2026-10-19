function writeAscii(view: DataView, offset: number, value: string) {
  [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
}

export function createWavFixture(durationSeconds = 8, sampleRate = 8000): Buffer {
  const channels = 1;
  const bitsPerSample = 16;
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const dataSize = sampleCount * channels * bitsPerSample / 8;
  const buffer = Buffer.alloc(44 + dataSize);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bitsPerSample / 8, true);
  view.setUint16(32, channels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  for (let index = 0; index < sampleCount; index++) {
    const sample = Math.sin(index / sampleRate * Math.PI * 2 * 220) * 0.1;
    view.setInt16(44 + index * 2, sample * 0x7fff, true);
  }
  return buffer;
}
