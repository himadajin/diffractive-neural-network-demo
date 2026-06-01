import { describe, expect, it } from "vitest";
import { sampleInputLight } from "./textures";

const GRID_SIZE = 28;

function index(x: number, y: number) {
  return y * GRID_SIZE + x;
}

describe("sampleInputLight", () => {
  it("returns no samples when there is no valid square input grid", () => {
    expect(sampleInputLight(null)).toEqual([]);
    expect(sampleInputLight(new Float32Array(10))).toEqual([]);
  });

  it("ignores cells below the light threshold", () => {
    const input = new Float32Array(GRID_SIZE * GRID_SIZE);
    input[index(3, 4)] = 0.011;

    expect(sampleInputLight(input)).toEqual([]);
  });

  it("converts active cells into normalized cell-center light samples", () => {
    const input = new Float32Array(GRID_SIZE * GRID_SIZE);
    input[index(7, 4)] = 0.5;

    expect(sampleInputLight(input)).toEqual([
      {
        x: (7 + 0.5) / GRID_SIZE,
        y: (4 + 0.5) / GRID_SIZE,
        nx: (7 + 0.5) / GRID_SIZE,
        ny: (4 + 0.5) / GRID_SIZE,
        alpha: 0.5,
      },
    ]);
  });

  it("keeps sample order deterministic across the 28-by-28 field", () => {
    const input = new Float32Array(GRID_SIZE * GRID_SIZE);
    input[index(2, 1)] = 0.4;
    input[index(1, 2)] = 0.6;

    expect(
      sampleInputLight(input).map((sample) => [sample.nx, sample.ny]),
    ).toEqual([
      [(2 + 0.5) / GRID_SIZE, (1 + 0.5) / GRID_SIZE],
      [(1 + 0.5) / GRID_SIZE, (2 + 0.5) / GRID_SIZE],
    ]);
  });
});
