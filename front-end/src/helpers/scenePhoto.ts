/**
 * Ghép watermark nghệ thuật Aura Museum lên ảnh chụp cảnh 3D rồi tải về.
 * Trả về false nếu không dựng được ảnh (ví dụ canvas rỗng).
 */
export function downloadScenePhoto(dataUrl: string | null, roomName?: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(false); return; }

      ctx.drawImage(img, 0, 0);

      // Dải mờ dưới đáy để chữ nổi trên mọi nền.
      const padX = Math.round(canvas.width * 0.03);
      const baseY = canvas.height - Math.round(canvas.height * 0.04);
      const fontMain = Math.max(16, Math.round(canvas.width * 0.028));
      const fontSub = Math.max(11, Math.round(canvas.width * 0.016));
      const grad = ctx.createLinearGradient(0, canvas.height - fontMain * 4, 0, canvas.height);
      grad.addColorStop(0, 'rgba(10,14,23,0)');
      grad.addColorStop(1, 'rgba(10,14,23,0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, canvas.height - fontMain * 4, canvas.width, fontMain * 4);

      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#10b981';
      ctx.font = `800 ${fontMain}px "Plus Jakarta Sans", Inter, sans-serif`;
      ctx.fillText('AURA MUSEUM', padX, baseY);

      ctx.fillStyle = 'rgba(241,245,249,0.9)';
      ctx.font = `600 ${fontSub}px Inter, sans-serif`;
      const date = new Date().toLocaleDateString('vi-VN');
      ctx.fillText(`${roomName ? roomName + ' · ' : ''}Ảnh kỷ niệm không gian 3D · ${date}`, padX, baseY + fontSub + 6);

      canvas.toBlob((blob) => {
        if (!blob) { resolve(false); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aura-museum-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        resolve(true);
      }, 'image/png');
    };
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
}
