export const MODEL_SIZE = 28;

const TARGET_INK_SIZE = 20;
const MIN_INK_ALPHA = 12;
const MIN_INK_AMOUNT = 2.5;

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  ink: number;
};

function alphaAt(
  data: ArrayLike<number>,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  if (x < 0 || x >= width || y < 0 || y >= height) return 0;
  return data[(y * width + x) * 4 + 3] ?? 0;
}

function findInkBounds(
  data: ArrayLike<number>,
  width: number,
  height: number,
): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let ink = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = alphaAt(data, width, height, x, y);
      if (alpha < MIN_INK_ALPHA) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      ink += alpha / 255;
    }
  }

  if (ink < MIN_INK_AMOUNT) return null;
  return { minX, minY, maxX, maxY, ink };
}

function sampleAlphaBilinear(
  data: ArrayLike<number>,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const tx = x - x0;
  const ty = y - y0;
  const top =
    alphaAt(data, width, height, x0, y0) * (1 - tx) +
    alphaAt(data, width, height, x1, y0) * tx;
  const bottom =
    alphaAt(data, width, height, x0, y1) * (1 - tx) +
    alphaAt(data, width, height, x1, y1) * tx;

  return (top * (1 - ty) + bottom * ty) / 255;
}

export function normalizeDigitInputData(
  data: ArrayLike<number>,
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) {
    return null;
  }

  const bounds = findInkBounds(data, width, height);
  if (!bounds) return null;

  const sourceWidth = Math.max(1, bounds.maxX - bounds.minX + 1);
  const sourceHeight = Math.max(1, bounds.maxY - bounds.minY + 1);
  const scale = TARGET_INK_SIZE / Math.max(sourceWidth, sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (MODEL_SIZE - drawWidth) / 2;
  const offsetY = (MODEL_SIZE - drawHeight) / 2;
  const input = new Float32Array(MODEL_SIZE * MODEL_SIZE);

  for (let y = 0; y < MODEL_SIZE; y += 1) {
    for (let x = 0; x < MODEL_SIZE; x += 1) {
      const localX = x + 0.5 - offsetX;
      const localY = y + 0.5 - offsetY;
      if (
        localX < 0 ||
        localX > drawWidth ||
        localY < 0 ||
        localY > drawHeight
      ) {
        continue;
      }

      // Crop, scale, and center only. Do not mirror or rotate; classifier input
      // must preserve the Drawing Panel's canonical orientation.
      const sourceX = bounds.minX + localX / scale;
      const sourceY = bounds.minY + localY / scale;
      input[y * MODEL_SIZE + x] = sampleAlphaBilinear(
        data,
        width,
        height,
        sourceX,
        sourceY,
      );
    }
  }

  return input;
}
