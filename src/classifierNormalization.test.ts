import { describe, expect, it } from "vitest";
import { MODEL_SIZE, normalizeDigitInputData } from "./classifierNormalization";

function rgba(width: number, height: number) {
  return new Uint8ClampedArray(width * height * 4);
}

function setAlpha(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  alpha = 255,
) {
  data[(y * width + x) * 4 + 3] = alpha;
}

function fillRect(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
  alpha = 255,
) {
  for (let py = y; py < y + rectHeight; py += 1) {
    for (let px = x; px < x + rectWidth; px += 1) {
      setAlpha(data, width, px, py, alpha);
    }
  }
}

function summedInk(
  input: Float32Array,
  area: "left" | "right" | "top" | "bottom",
) {
  let sum = 0;

  for (let y = 0; y < MODEL_SIZE; y += 1) {
    for (let x = 0; x < MODEL_SIZE; x += 1) {
      const value = input[y * MODEL_SIZE + x];
      if (area === "left" && x < MODEL_SIZE / 2) sum += value;
      if (area === "right" && x >= MODEL_SIZE / 2) sum += value;
      if (area === "top" && y < MODEL_SIZE / 2) sum += value;
      if (area === "bottom" && y >= MODEL_SIZE / 2) sum += value;
    }
  }

  return sum;
}

describe("normalizeDigitInputData", () => {
  it("returns null for empty, tiny, and invalid input", () => {
    expect(normalizeDigitInputData(rgba(12, 12), 12, 12)).toBeNull();

    const tiny = rgba(12, 12);
    setAlpha(tiny, 12, 4, 4);
    expect(normalizeDigitInputData(tiny, 12, 12)).toBeNull();

    expect(normalizeDigitInputData(new Uint8ClampedArray(4), 2, 2)).toBeNull();
  });

  it("normalizes ink into a 28-by-28 classifier input", () => {
    const data = rgba(40, 40);
    fillRect(data, 40, 12, 8, 9, 20);

    const input = normalizeDigitInputData(data, 40, 40);

    expect(input).toBeInstanceOf(Float32Array);
    expect(input).toHaveLength(MODEL_SIZE * MODEL_SIZE);
    expect(Math.max(...input!)).toBeLessThanOrEqual(1);
    expect(Math.min(...input!)).toBeGreaterThanOrEqual(0);
  });

  it("preserves canonical left-right input orientation", () => {
    const data = rgba(40, 40);
    fillRect(data, 40, 8, 8, 4, 24);
    fillRect(data, 40, 8, 28, 21, 4);

    const input = normalizeDigitInputData(data, 40, 40);

    expect(input).not.toBeNull();
    expect(summedInk(input!, "left")).toBeGreaterThan(
      summedInk(input!, "right"),
    );
  });

  it("preserves canonical top-bottom input orientation", () => {
    const data = rgba(40, 40);
    fillRect(data, 40, 8, 8, 4, 24);
    fillRect(data, 40, 8, 28, 21, 4);

    const input = normalizeDigitInputData(data, 40, 40);

    expect(input).not.toBeNull();
    expect(summedInk(input!, "bottom")).toBeGreaterThan(
      summedInk(input!, "top"),
    );
  });
});
