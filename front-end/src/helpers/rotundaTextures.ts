/** Hoạ tiết kiến trúc vẽ bằng Canvas 2D: không tải thêm ảnh, không mô phỏng hiện vật có thật. */
function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  return { canvas, context: canvas.getContext('2d') };
}

/** Dải sáng hắt tường: trắng, alpha mạnh ở đáy (v = 0) rồi tắt dần — màu do material quyết định. */
export function drawWash(): HTMLCanvasElement {
  const { canvas, context } = canvasOf(8, 256);
  if (context) {
    const gradient = context.createLinearGradient(0, 256, 0, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.35, 'rgba(255,255,255,.45)');
    gradient.addColorStop(.75, 'rgba(255,255,255,.08)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 8, 256);
  }
  return canvas;
}

/** Quầng sáng tròn quanh chân bục trung tâm. */
export function drawHalo(): HTMLCanvasElement {
  const { canvas, context } = canvasOf(256, 256);
  if (context) {
    const gradient = context.createRadialGradient(128, 128, 60, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255,255,255,0)'); gradient.addColorStop(.18, 'rgba(255,255,255,.9)');
    gradient.addColorStop(.5, 'rgba(255,255,255,.25)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 256, 256);
  }
  return canvas;
}

/** Giếng trời giả lập: mặt kính mờ phát sáng với nan chia, không vẽ cảnh ngoài trời. */
export function drawSkylight(): HTMLCanvasElement {
  const { canvas, context } = canvasOf(512, 512);
  if (context) {
    const glow = context.createRadialGradient(256, 256, 20, 256, 256, 256);
    glow.addColorStop(0, '#fffdf6'); glow.addColorStop(.7, '#fbf1dc'); glow.addColorStop(1, '#e9d6b2');
    context.fillStyle = glow; context.fillRect(0, 0, 512, 512);
    context.strokeStyle = 'rgba(122,96,58,.55)'; context.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      context.beginPath(); context.moveTo(256 + Math.cos(angle) * 58, 256 + Math.sin(angle) * 58);
      context.lineTo(256 + Math.cos(angle) * 256, 256 + Math.sin(angle) * 256); context.stroke();
    }
    for (const radius of [58, 150]) { context.beginPath(); context.arc(256, 256, radius, 0, Math.PI * 2); context.stroke(); }
  }
  return canvas;
}

/** Phù điêu hình học trừu tượng (vòng đồng tâm, sóng nước, chữ V, hồi văn) trên nền trong suốt. */
export function drawFrieze(): HTMLCanvasElement {
  const { canvas, context } = canvasOf(256, 1024);
  if (context) {
    context.strokeStyle = '#d9b36f'; context.lineWidth = 2.5; context.lineCap = 'round';
    context.strokeRect(14, 14, 228, 996);
    const meander = (y: number) => {
      context.beginPath();
      for (let x = 26; x < 226; x += 24) {
        context.moveTo(x, y + 18); context.lineTo(x, y); context.lineTo(x + 16, y); context.lineTo(x + 16, y + 12);
        context.lineTo(x + 7, y + 12); context.lineTo(x + 7, y + 6);
        context.moveTo(x, y + 18); context.lineTo(x + 24, y + 18);
      }
      context.stroke();
    };
    const waves = (y: number) => {
      for (let row = 0; row < 3; row++) {
        context.beginPath();
        for (let x = 26; x <= 230; x += 2) {
          const py = y + row * 12 + Math.sin((x - 26) / 204 * Math.PI * 6) * 5;
          if (x === 26) context.moveTo(x, py); else context.lineTo(x, py);
        }
        context.stroke();
      }
    };
    const chevrons = (y: number) => {
      for (let row = 0; row < 3; row++) {
        context.beginPath();
        for (let x = 26; x < 230; x += 34) { context.moveTo(x, y + row * 14 + 14); context.lineTo(x + 17, y + row * 14); context.lineTo(x + 34, y + row * 14 + 14); }
        context.stroke();
      }
    };
    const rings = (y: number, radius: number) => {
      for (let r = radius; r > 8; r -= radius / 5) { context.beginPath(); context.arc(128, y, r, 0, Math.PI * 2); context.stroke(); }
      for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI / 12;
        context.beginPath(); context.moveTo(128 + Math.cos(angle) * (radius + 6), y + Math.sin(angle) * (radius + 6));
        context.lineTo(128 + Math.cos(angle) * (radius + 16), y + Math.sin(angle) * (radius + 16)); context.stroke();
      }
    };
    meander(34); waves(84); rings(250, 84); chevrons(382); meander(446);
    rings(600, 70); waves(712); chevrons(772); rings(888, 62); meander(972);
  }
  return canvas;
}

/** Biển trên vách trung tâm: nhận diện bảo tàng + tên phòng lấy từ CMS (đã theo ngôn ngữ của khách). */
export function drawRotundaSign(roomName?: string): HTMLCanvasElement {
  const { canvas, context } = canvasOf(1024, 512);
  if (context) {
    context.textAlign = 'center'; context.fillStyle = '#7a5a2c';
    // Chữ dồn lên nửa trên của biển để không bị hiện vật ở bục trung tâm che.
    context.font = '104px Georgia, "Times New Roman", serif'; context.fillText('A U R A', 512, 118);
    context.fillRect(380, 158, 60, 2); context.fillRect(584, 158, 60, 2);
    context.font = '30px Georgia, "Times New Roman", serif'; context.fillText('M U S E U M', 512, 169);
    const name = roomName?.trim();
    if (name) {
      context.fillStyle = '#4f4636';
      let size = 42;
      do { context.font = `${size}px Georgia, "Times New Roman", serif`; size -= 2; } while (size > 20 && context.measureText(name).width > 900);
      context.fillText(context.measureText(name).width > 900 ? `${name.slice(0, 44).trimEnd()}…` : name, 512, 238);
    }
  }
  return canvas;
}
