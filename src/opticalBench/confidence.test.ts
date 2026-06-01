import { describe, expect, it } from "vitest";
import { DIGITS } from "./constants";
import { smoothConfidence } from "./confidence";
import type { SceneState } from "./types";

function confidenceState(
  confidence: number[],
  targetConfidence: number[],
): SceneState {
  return { confidence, targetConfidence } as SceneState;
}

describe("smoothConfidence", () => {
  it("moves confidence values toward their targets without overshooting", () => {
    const state = confidenceState(
      [0.2, 0.8, ...Array(DIGITS - 2).fill(0)],
      [1, 0, ...Array(DIGITS - 2).fill(0)],
    );

    const changed = smoothConfidence(state);

    expect(changed).toBe(true);
    expect(state.confidence[0]).toBeGreaterThan(0.2);
    expect(state.confidence[0]).toBeLessThanOrEqual(1);
    expect(state.confidence[1]).toBeLessThan(0.8);
    expect(state.confidence[1]).toBeGreaterThanOrEqual(0);
  });

  it("snaps tiny differences directly to the target", () => {
    const state = confidenceState(
      [0.9998, ...Array(DIGITS - 1).fill(0)],
      [1, ...Array(DIGITS - 1).fill(0)],
    );

    expect(smoothConfidence(state)).toBe(true);
    expect(state.confidence[0]).toBe(1);
  });

  it("reports no change when confidence already matches the target", () => {
    const confidence = [0.4, 0.6, ...Array(DIGITS - 2).fill(0)];
    const state = confidenceState([...confidence], [...confidence]);

    expect(smoothConfidence(state)).toBe(false);
    expect(state.confidence).toEqual(confidence);
  });
});
