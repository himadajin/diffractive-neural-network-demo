import * as ort from "onnxruntime-web";

const DIGIT_COUNT = 10;
const MODEL_SIZE = 28;
const TARGET_INK_SIZE = 20;
const MIN_INK_ALPHA = 12;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = {
  mjs: new URL(
    "ort/ort-wasm-simd-threaded.jsep.mjs",
    import.meta.env.BASE_URL,
  ).toString(),
  wasm: new URL(
    "ort/ort-wasm-simd-threaded.jsep.wasm",
    import.meta.env.BASE_URL,
  ).toString(),
};

function getSession() {
  sessionPromise ??= ort.InferenceSession.create("/models/mnist-8.onnx", {
    executionProviders: ["wasm"],
  });
  return sessionPromise;
}

function softmax(values: number[]) {
  const max = Math.max(...values);
  const exp = values.map((value) => Math.exp(value - max));
  const total = exp.reduce((sum, value) => sum + value, 0);
  return exp.map((value) => value / total);
}

function normalizeDigit(canvas: HTMLCanvasElement) {
  const source = canvas.getContext("2d", { willReadFrequently: true });
  if (!source) return null;

  const image = source.getImageData(0, 0, canvas.width, canvas.height);
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  let ink = 0;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = image.data[(y * canvas.width + x) * 4 + 3];
      if (alpha < MIN_INK_ALPHA) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      ink += alpha / 255;
    }
  }

  if (ink < 2.5) return null;

  const width = Math.max(1, maxX - minX + 1);
  const height = Math.max(1, maxY - minY + 1);
  const scale = TARGET_INK_SIZE / Math.max(width, height);
  const normalized = document.createElement("canvas");
  normalized.width = MODEL_SIZE;
  normalized.height = MODEL_SIZE;
  const ctx = normalized.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, MODEL_SIZE, MODEL_SIZE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const offsetX = (MODEL_SIZE - drawWidth) / 2;
  const offsetY = (MODEL_SIZE - drawHeight) / 2;
  // Preserve the viewer-upright handedness shared by the Drawing Panel,
  // Input Surface, and Classifier. Normalization crops and scales only.
  ctx.drawImage(
    canvas,
    minX,
    minY,
    width,
    height,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight,
  );

  const normalizedImage = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  const input = new Float32Array(MODEL_SIZE * MODEL_SIZE);
  for (let i = 0; i < input.length; i += 1) {
    input[i] = normalizedImage.data[i * 4 + 3] / 255;
  }

  return input;
}

export async function classifyDigit(canvas: HTMLCanvasElement) {
  const input = normalizeDigit(canvas);
  if (!input) return Array(DIGIT_COUNT).fill(0);

  const session = await getSession();
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  const feeds: Record<string, ort.Tensor> = {
    [inputName]: new ort.Tensor("float32", input, [
      1,
      1,
      MODEL_SIZE,
      MODEL_SIZE,
    ]),
  };
  const output = await session.run(feeds);
  const logits = Array.from(output[outputName].data as Float32Array).slice(
    0,
    DIGIT_COUNT,
  );
  return softmax(logits);
}
