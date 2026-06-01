import { describe, expect, it } from "vitest";
import { DIGIT_ANCHORS, DIGITS } from "./constants";
import {
  buildCandidateField,
  buildCircuitField,
  buildFeatureBundleField,
  buildFirstLensField,
  CELL_FIELD_GRID_SIZE,
  cellIndex,
  fieldFromSamples,
} from "./lightField";
import type { InputLightSample } from "./types";

function sample(nx: number, ny: number, alpha = 1): InputLightSample {
  return { x: nx, y: ny, nx, ny, alpha };
}

function expectFieldShape(field: Float32Array) {
  expect(field).toHaveLength(CELL_FIELD_GRID_SIZE * CELL_FIELD_GRID_SIZE);
  expect(Math.min(...field)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...field)).toBeLessThanOrEqual(1);
}

function strongestCell(field: Float32Array) {
  let index = 0;
  let value = -Infinity;
  for (let i = 0; i < field.length; i += 1) {
    if (field[i] <= value) continue;
    index = i;
    value = field[i];
  }
  return {
    x: index % CELL_FIELD_GRID_SIZE,
    y: Math.floor(index / CELL_FIELD_GRID_SIZE),
    value,
  };
}

describe("light field generation", () => {
  it("keeps every field on the fixed 28-by-28 cell grid", () => {
    const samples = [sample(0.42, 0.58)];
    const confidence = Array(DIGITS).fill(0);
    confidence[3] = 0.8;

    [
      fieldFromSamples(samples),
      buildFirstLensField(samples, 1),
      buildCircuitField(samples, 2),
      buildFeatureBundleField(samples, confidence, 3),
      buildCandidateField(samples, confidence, 4),
    ].forEach(expectFieldShape);
  });

  it("normalizes active fields to a stable peak without changing empty fields", () => {
    const empty = fieldFromSamples([]);
    expectFieldShape(empty);
    expect(Math.max(...empty)).toBe(0);

    const active = fieldFromSamples([sample(0.5, 0.5, 0.4)]);
    expectFieldShape(active);
    expect(Math.max(...active)).toBe(1);
  });

  it("drops low-energy input samples before generating light", () => {
    const field = fieldFromSamples([sample(0.5, 0.5, 0.007)]);

    expect(Math.max(...field)).toBe(0);
  });

  it("routes candidate fields toward the strongest digit anchor", () => {
    const confidence = Array(DIGITS).fill(0.02);
    confidence[0] = 0.9;

    const field = buildCandidateField([sample(0.5, 0.5)], confidence, 4);
    const strongest = strongestCell(field);
    const winnerAnchor = DIGIT_ANCHORS[0];
    const winnerCell = {
      x: Math.round((0.5 + (winnerAnchor.x - 0.5) * 0.74) * 27),
      y: Math.round((0.5 + (winnerAnchor.y - 0.5) * 0.74) * 27),
    };

    expectFieldShape(field);
    expect(strongest.value).toBeGreaterThan(0);
    expect(
      Math.hypot(strongest.x - winnerCell.x, strongest.y - winnerCell.y),
    ).toBeLessThanOrEqual(1.5);
  });

  it("keeps weaker candidates visible instead of reducing them to zero", () => {
    const confidence = Array(DIGITS).fill(0);
    confidence[0] = 0.8;
    confidence[4] = 0.3;
    const field = buildCandidateField([sample(0.5, 0.5)], confidence, 4);
    const anchor = DIGIT_ANCHORS[4];
    const x = Math.round((0.5 + (anchor.x - 0.5) * 0.74) * 27);
    const y = Math.round((0.5 + (anchor.y - 0.5) * 0.74) * 27);

    expect(field[cellIndex(x, y)]).toBeGreaterThan(0);
  });
});
