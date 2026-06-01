import { describe, expect, it } from "vitest";
import { DIGIT_ANCHORS, getResponsiveCamera } from "./constants";

function expectFiniteCamera(camera: ReturnType<typeof getResponsiveCamera>) {
  expect(Number.isFinite(camera.fov)).toBe(true);
  expect(Number.isFinite(camera.position.x)).toBe(true);
  expect(Number.isFinite(camera.position.y)).toBe(true);
  expect(Number.isFinite(camera.position.z)).toBe(true);
  expect(Number.isFinite(camera.target.x)).toBe(true);
  expect(Number.isFinite(camera.target.y)).toBe(true);
  expect(Number.isFinite(camera.target.z)).toBe(true);
}

describe("getResponsiveCamera", () => {
  it("returns finite camera configs for representative viewport sizes", () => {
    [
      [1440, 900],
      [1024, 768],
      [390, 844],
      [844, 390],
      [0, 0],
    ].forEach(([width, height]) => {
      const camera = getResponsiveCamera(width, height);

      expectFiniteCamera(camera);
      expect(camera.fov).toBeGreaterThan(0);
      expect(camera.fov).toBeLessThan(90);
    });
  });

  it("keeps narrow and short presentations at least as wide as roomy ones", () => {
    expect(getResponsiveCamera(400, 800).fov).toBeGreaterThanOrEqual(
      getResponsiveCamera(1200, 800).fov,
    );
    expect(getResponsiveCamera(1000, 400).fov).toBeGreaterThanOrEqual(
      getResponsiveCamera(1000, 900).fov,
    );
  });

  it("is deterministic for the same viewport", () => {
    expect(getResponsiveCamera(768, 1024)).toEqual(
      getResponsiveCamera(768, 1024),
    );
  });
});

describe("DIGIT_ANCHORS", () => {
  it("places all ten digit marks inside normalized output-screen space", () => {
    expect(DIGIT_ANCHORS).toHaveLength(10);

    DIGIT_ANCHORS.forEach((anchor) => {
      expect(anchor.x).toBeGreaterThanOrEqual(0);
      expect(anchor.x).toBeLessThanOrEqual(1);
      expect(anchor.y).toBeGreaterThanOrEqual(0);
      expect(anchor.y).toBeLessThanOrEqual(1);
    });
  });

  it("keeps digit marks arranged on one circular registration path", () => {
    const [firstAnchor] = DIGIT_ANCHORS;
    const radius = Math.hypot(firstAnchor.x - 0.5, firstAnchor.y - 0.5);

    DIGIT_ANCHORS.forEach((anchor) => {
      expect(Math.hypot(anchor.x - 0.5, anchor.y - 0.5)).toBeCloseTo(radius);
    });
  });
});
