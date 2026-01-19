export type ShapeType = 'circle' | 'square' | 'triangle' | 'diamond' | 'star' | 'heart' | 'hex' | 'parallel';

export const SHAPES = {
  circle: true,
  square: true,
  triangle: true,
  diamond: true,
  star: true,
  heart: true,
  hex: true,
  parallel: true,
};

const HEART_PATH_DATA = 'M12 21s-6.7-4.35-9.2-7.7C1 11.2 1.2 7.8 3.5 6c1.8-1.4 4.4-1.2 6 0.6L12 9l2.5-2.4c1.6-1.8 4.2-2 6-0.6 2.3 1.8 2.5 5.2 0.7 7.3C18.7 16.7 12 21 12 21z';
let heartPath: Path2D | null = null;

export interface ProcessorSettings {
  gridSize: number;
  contrast: number;
  fgColor: string;
  bgColor: string;
  shape: ShapeType;
  invert: boolean;
  uniformSize: boolean;
  overlap: number;
  edgeDetection?: boolean;
  sensitivity?: number;
}

export function processImage(sourceCanvas: HTMLCanvasElement, targetCanvas: HTMLCanvasElement, settings: ProcessorSettings) {
  const sourceCtx = sourceCanvas.getContext('2d');
  const targetCtx = targetCanvas.getContext('2d');
  if (!sourceCtx || !targetCtx) return;

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  targetCanvas.width = width;
  targetCanvas.height = height;

  const bgIsTransparent = isTransparentColor(settings.bgColor);
  const fgIsTransparent = isTransparentColor(settings.fgColor);

  // Fill background or clear for transparency
  if (bgIsTransparent) {
    targetCtx.clearRect(0, 0, width, height);
  } else {
    targetCtx.fillStyle = settings.bgColor;
    targetCtx.fillRect(0, 0, width, height);
  }

  const cols = Math.ceil(width / settings.gridSize);
  const rows = Math.ceil(height / settings.gridSize);

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = i * settings.gridSize;
      const y = j * settings.gridSize;
      const cellWidth = Math.min(settings.gridSize, width - x);
      const cellHeight = Math.min(settings.gridSize, height - y);

      // Get average brightness
      const imageData = sourceCtx.getImageData(x, y, cellWidth, cellHeight);
      const data = imageData.data;
      let total = 0;
      let edgeStrength = 0;

      // Calculate average brightness
      for (let k = 0; k < data.length; k += 4) {
        const r = data[k];
        const g = data[k + 1];
        const b = data[k + 2];
        const brightness = (r + g + b) / 3;
        total += brightness;
      }

      const avgBrightness = total / (data.length / 4);

      // Optional edge detection for better feature adaptation
      if (settings.edgeDetection) {
        // Detect edges by measuring variance in the cell
        for (let k = 0; k < data.length; k += 4) {
          const r = data[k];
          const g = data[k + 1];
          const b = data[k + 2];
          const brightness = (r + g + b) / 3;
          const diff = Math.abs(brightness - avgBrightness);
          edgeStrength += diff;
        }
        edgeStrength = edgeStrength / (data.length / 4);
      }

      let adjustedBrightness = Math.pow(avgBrightness / 255, 1 / settings.contrast) * 255;

      if (settings.invert) {
        adjustedBrightness = 255 - adjustedBrightness;
      }
      const maxSize = Math.min(cellWidth, cellHeight) / 2;
      let size: number;
      if (settings.uniformSize) {
        size = adjustedBrightness > 128 ? maxSize : 0;
      } else {
        size = ((255 - adjustedBrightness) / 255) * maxSize;
      }
      if (settings.edgeDetection && edgeStrength > 0) {
        const sensitivity = settings.sensitivity ?? 1;
        const edgeBoost = Math.min(1, (edgeStrength * sensitivity) / 40);
        size *= 1 + edgeBoost * 0.6;
      }
      size *= (1 + settings.overlap);
      if (size < 0) size = 0;

      if (size > 0 && !fgIsTransparent) {
        targetCtx.fillStyle = settings.fgColor;
        drawShape(targetCtx, settings.shape, x + cellWidth / 2, y + cellHeight / 2, size, settings.fgColor);
      }
    }
  }
}

function isTransparentColor(color: string) {
  const normalized = color.trim().toLowerCase();
  return normalized === 'transparent' || normalized === '#00000000' || normalized === 'rgba(0,0,0,0)';
}

function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeType, x: number, y: number, size: number, fgColor?: string) {
  ctx.save();
  ctx.translate(x, y);
  if (shape === 'parallel') {
    drawParallel(ctx, size, fgColor);
  } else {
    switch (shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'square':
        ctx.fillRect(-size, -size, size * 2, size * 2);
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(-size, size);
        ctx.lineTo(size, size);
        ctx.closePath();
        ctx.fill();
        break;
      case 'diamond':
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-size, -size, size * 2, size * 2);
        break;
      case 'star':
        drawStar(ctx, 0, 0, 5, size, size / 2);
        break;
      case 'heart':
        drawHeart(ctx, 0, 0, size);
        break;
      case 'hex':
        drawHex(ctx, 0, 0, size);
        break;
    }
  }
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
  ctx.fill();
}

function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  if (!heartPath && typeof Path2D !== 'undefined') {
    heartPath = new Path2D(HEART_PATH_DATA);
  }
  if (heartPath) {
    const scale = (2 * size) / 24;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-12, -12);
    ctx.fill(heartPath);
    ctx.restore();
    return;
  }

  const topCurveHeight = size * 0.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy + topCurveHeight);
  ctx.bezierCurveTo(cx, cy + topCurveHeight - size / 2, cx - size, cy + topCurveHeight - size / 2, cx - size, cy);
  ctx.bezierCurveTo(cx - size, cy - topCurveHeight / 2, cx, cy - topCurveHeight, cx, cy - topCurveHeight);
  ctx.bezierCurveTo(cx, cy - topCurveHeight, cx + size, cy - topCurveHeight / 2, cx + size, cy);
  ctx.bezierCurveTo(cx + size, cy + topCurveHeight - size / 2, cx, cy + topCurveHeight - size / 2, cx, cy + topCurveHeight);
  ctx.closePath();
  ctx.fill();
}

function drawHex(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawParallel(ctx: CanvasRenderingContext2D, size: number, fgColor?: string) {
  if (!fgColor) return;
  ctx.strokeStyle = fgColor;
  const scaleX = (2 * size) / 313;
  const scaleY = (2 * size) / 278;
  ctx.save();
  ctx.translate(- (313 / 2) * scaleX, - (278 / 2) * scaleY);
  const lines = [
    { x: 19.8438, width: 39.6876, y1: 19.8438, y2: 257.969 },
    { x: 139.095, width: 39.6876, y1: 19.8438, y2: 257.969 },
    { x: 298.034, width: 29.7657, y1: 14.8828, y2: 262.93 },
    { x: 220.554, width: 49.6095, y1: 24.8047, y2: 253.008 },
    { x: 79.4644, width: 19.8438, y1: 9.92188, y2: 267.891 }
  ];
  lines.forEach(line => {
    ctx.lineWidth = line.width * scaleX;
    ctx.beginPath();
    ctx.moveTo(line.x * scaleX, line.y1 * scaleY);
    ctx.lineTo(line.x * scaleX, line.y2 * scaleY);
    ctx.stroke();
  });
  ctx.restore();
}

export function processFrame(sourceCanvas: HTMLCanvasElement, targetCanvas: HTMLCanvasElement, settings: ProcessorSettings) {
  processImage(sourceCanvas, targetCanvas, settings);
}
