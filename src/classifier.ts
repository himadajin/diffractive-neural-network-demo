import * as ort from "onnxruntime-web";
import { MODEL_SIZE, normalizeDigitInputData } from "./classifierNormalization";

const DIGIT_COUNT = 10;
export { MODEL_SIZE };

let sessionPromise: Promise<ort.InferenceSession> | null = null;

const appAssetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;
const absoluteAppAssetUrl = (path: string) =>
  new URL(appAssetUrl(path), window.location.href).href;

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = {
  mjs: absoluteAppAssetUrl("ort/ort-wasm-simd-threaded.jsep.mjs"),
  wasm: absoluteAppAssetUrl("ort/ort-wasm-simd-threaded.jsep.wasm"),
};

function getSession() {
  sessionPromise ??= ort.InferenceSession.create(
    appAssetUrl("models/mnist-8.onnx"),
    {
      executionProviders: ["wasm"],
    },
  );
  return sessionPromise;
}

function softmax(values: number[]) {
  const max = Math.max(...values);
  const exp = values.map((value) => Math.exp(value - max));
  const total = exp.reduce((sum, value) => sum + value, 0);
  return exp.map((value) => value / total);
}

export function normalizeDigitInput(canvas: HTMLCanvasElement) {
  const source = canvas.getContext("2d", { willReadFrequently: true });
  if (!source) return null;

  const image = source.getImageData(0, 0, canvas.width, canvas.height);
  return normalizeDigitInputData(image.data, canvas.width, canvas.height);
}

export async function classifyDigit(canvas: HTMLCanvasElement) {
  const input = normalizeDigitInput(canvas);
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
