import { classifyDigit } from "../classifier";
import { DIGITS } from "./constants";
import type { SceneState } from "./types";

export function visualFallbackConfidence(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return Array(DIGITS).fill(0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let ink = 0;
  let sx = 0;
  let sy = 0;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  let center = 0;
  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;

  for (let y = 0; y < canvas.height; y += 8) {
    for (let x = 0; x < canvas.width; x += 8) {
      const alpha = image[(y * canvas.width + x) * 4 + 3] / 255;
      if (alpha < 0.04) continue;
      ink += alpha;
      sx += x * alpha;
      sy += y * alpha;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (x > canvas.width * 0.42 && x < canvas.width * 0.58) center += alpha;
      if (x < canvas.width * 0.42) left += alpha;
      if (x > canvas.width * 0.58) right += alpha;
      if (y < canvas.height * 0.38) top += alpha;
      if (y > canvas.height * 0.62) bottom += alpha;
    }
  }

  if (ink <= 0) return Array(DIGITS).fill(0);

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const aspect = width / height;
  const cx = sx / ink / canvas.width;
  const cy = sy / ink / canvas.height;
  const scores = [
    0.55 + Math.abs(aspect - 0.72) * -0.28 + ink * 0.0008,
    0.75 + center / ink + Math.max(0, 0.42 - aspect),
    0.45 + (right / ink) * 0.7 + Math.max(0, 0.62 - cy) * 0.45,
    0.44 + (right / ink) * 0.52 + (bottom / ink) * 0.28,
    0.4 + Math.max(0, 0.72 - aspect) + (right / ink) * 0.38,
    0.4 + (left / ink) * 0.35 + (bottom / ink) * 0.33,
    0.42 + (left / ink) * 0.45 + (bottom / ink) * 0.42,
    0.48 + (top / ink) * 0.45 + Math.max(0, 0.52 - cy),
    0.58 + Math.abs(aspect - 0.68) * -0.2 + (center / ink) * 0.2,
    0.47 + (top / ink) * 0.38 + (right / ink) * 0.32,
  ].map((score, digit) => Math.exp(score * 2.4 + Math.sin(cx * 6 + digit)));

  const total = scores.reduce((sum, value) => sum + value, 0);
  return scores.map((score) => score / total);
}

export function requestClassification(state: SceneState) {
  const requestId = state.classificationRequestId + 1;
  state.classificationRequestId = requestId;
  state.targetConfidence = visualFallbackConfidence(state.inputCanvas);
  void classifyDigit(state.inputCanvas)
    .then((confidence) => {
      if (state.classificationRequestId !== requestId || !state.hasInk) return;
      const strongest = Math.max(...confidence);
      if (strongest <= 0.001) return;
      state.targetConfidence = confidence;
    })
    .catch((error: unknown) => {
      console.warn("Digit classifier failed", error);
    });
}

export function smoothConfidence(state: SceneState) {
  for (let i = 0; i < DIGITS; i += 1) {
    state.confidence[i] +=
      (state.targetConfidence[i] - state.confidence[i]) * 0.08;
  }
}
