import { describe, expect, it } from "vitest";
import {
  distanceBetween,
  dollyCamera,
  midpoint,
  orbitCamera,
  panCamera,
  updateHiddenDebugTap,
} from "./cameraControls";
import { DEFAULT_CAMERA } from "./constants";
import type { CameraConfig, Point3 } from "./types";

function distance(a: Point3, b: Point3) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function offset(config: CameraConfig) {
  return {
    x: config.position.x - config.target.x,
    y: config.position.y - config.target.y,
    z: config.position.z - config.target.z,
  };
}

describe("camera movement helpers", () => {
  it("orbits around the current target without moving the target", () => {
    const next = orbitCamera(DEFAULT_CAMERA, 20, -12);

    expect(next.target).toEqual(DEFAULT_CAMERA.target);
    expect(next.position).not.toEqual(DEFAULT_CAMERA.position);
    expect(distance(next.position, next.target)).toBeCloseTo(
      distance(DEFAULT_CAMERA.position, DEFAULT_CAMERA.target),
      2,
    );
  });

  it("pans position and target together while preserving the view offset", () => {
    const next = panCamera(DEFAULT_CAMERA, 30, -18, 900);

    expect(next.position).not.toEqual(DEFAULT_CAMERA.position);
    expect(next.target).not.toEqual(DEFAULT_CAMERA.target);
    expect(offset(next).x).toBeCloseTo(offset(DEFAULT_CAMERA).x);
    expect(offset(next).y).toBeCloseTo(offset(DEFAULT_CAMERA).y);
    expect(offset(next).z).toBeCloseTo(offset(DEFAULT_CAMERA).z);
    expect(next.fov).toBe(DEFAULT_CAMERA.fov);
  });

  it("dollies along the view direction while keeping the target fixed", () => {
    const closer = dollyCamera(DEFAULT_CAMERA, -40);
    const farther = dollyCamera(DEFAULT_CAMERA, 40);

    expect(closer.target).toEqual(DEFAULT_CAMERA.target);
    expect(farther.target).toEqual(DEFAULT_CAMERA.target);
    expect(distance(closer.position, closer.target)).toBeLessThan(
      distance(DEFAULT_CAMERA.position, DEFAULT_CAMERA.target),
    );
    expect(distance(farther.position, farther.target)).toBeGreaterThan(
      distance(DEFAULT_CAMERA.position, DEFAULT_CAMERA.target),
    );
  });

  it("keeps dolly distance inside the supported interaction range", () => {
    const tooClose = dollyCamera(DEFAULT_CAMERA, -1000);
    const tooFar = dollyCamera(DEFAULT_CAMERA, 1000);

    expect(distance(tooClose.position, tooClose.target)).toBeCloseTo(1.2, 2);
    expect(distance(tooFar.position, tooFar.target)).toBeCloseTo(16, 2);
  });
});

describe("pointer helpers", () => {
  it("calculates point distance and midpoint", () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpoint({ x: 2, y: 4 }, { x: 8, y: 10 })).toEqual({
      x: 5,
      y: 7,
    });
  });
});

describe("hidden debug tap gesture", () => {
  it("toggles only after enough taps inside the hidden corner zone", () => {
    let state = { count: 0, firstTapAt: 0 };
    let shouldToggle = false;

    for (let i = 0; i < 4; i += 1) {
      const result = updateHiddenDebugTap(state, { x: 12, y: 12 }, 1000 + i);
      state = result.state;
      shouldToggle = result.shouldToggle;
    }

    expect(shouldToggle).toBe(false);
    const result = updateHiddenDebugTap(state, { x: 12, y: 12 }, 1004);
    expect(result.shouldToggle).toBe(true);
    expect(result.state).toEqual({ count: 0, firstTapAt: 0 });
  });

  it("ignores taps outside the hidden corner zone", () => {
    const state = { count: 3, firstTapAt: 1000 };
    const result = updateHiddenDebugTap(state, { x: 80, y: 12 }, 1200);

    expect(result).toEqual({ state, shouldToggle: false });
  });

  it("restarts the tap count after the gesture window expires", () => {
    const state = { count: 4, firstTapAt: 1000 };
    const result = updateHiddenDebugTap(state, { x: 12, y: 12 }, 5001);

    expect(result.shouldToggle).toBe(false);
    expect(result.state).toEqual({ count: 1, firstTapAt: 5001 });
  });
});
