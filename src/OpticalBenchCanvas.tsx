import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { CameraDebugControls } from "./opticalBench/CameraDebugControls";
import { DEFAULT_CAMERA, DIGITS } from "./opticalBench/constants";
import { requestClassification } from "./opticalBench/confidence";
import { pointOnInput } from "./opticalBench/inputSurface";
import {
  animate,
  applyCamera,
  createScene,
  resize,
} from "./opticalBench/scene";
import { drawInputStroke, resetInputCanvas } from "./opticalBench/textures";
import type { CameraConfig, SceneState } from "./opticalBench/types";

export type OpticalBenchHandle = {
  clear: () => void;
};

function isDebugMode() {
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

export const OpticalBenchCanvas = forwardRef<
  OpticalBenchHandle,
  { onInkChange: (hasInk: boolean) => void }
>(function OpticalBenchCanvas({ onInkChange }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<SceneState | null>(null);
  const debug = useMemo(isDebugMode, []);
  const [cameraConfig, setCameraConfig] =
    useState<CameraConfig>(DEFAULT_CAMERA);

  useImperativeHandle(ref, () => ({
    clear: () => {
      const state = stateRef.current;
      if (!state) return;
      resetInputCanvas(state.inputCanvas);
      state.inputTexture.needsUpdate = true;
      state.hasInk = false;
      state.classificationRequestId += 1;
      state.classificationQueued = false;
      state.targetConfidence = Array(DIGITS).fill(0);
      state.lastInkPoint = null;
      state.onInkChange(false);
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const state = createScene(container, onInkChange, DEFAULT_CAMERA);
    stateRef.current = state;
    resize(container, state);
    animate(state);

    const handleResize = () => resize(container, state);
    const handlePointerDown = (event: PointerEvent) => {
      const point = pointOnInput(event, container, state);
      if (!point) return;
      event.preventDefault();
      state.activePointerId = event.pointerId;
      state.lastInkPoint = point;
      drawInputStroke(state.inputCanvas, null, point);
      state.inputTexture.needsUpdate = true;
      state.hasInk = true;
      requestClassification(state);
      state.onInkChange(true);
      state.renderer.domElement.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (state.activePointerId !== event.pointerId) return;
      const point = pointOnInput(event, container, state);
      if (!point) return;
      event.preventDefault();
      drawInputStroke(state.inputCanvas, state.lastInkPoint, point);
      state.lastInkPoint = point;
      state.inputTexture.needsUpdate = true;
      state.hasInk = true;
      requestClassification(state);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (state.activePointerId !== event.pointerId) return;
      state.activePointerId = null;
      state.lastInkPoint = null;
      state.renderer.domElement.releasePointerCapture(event.pointerId);
    };

    window.addEventListener("resize", handleResize);
    state.renderer.domElement.addEventListener(
      "pointerdown",
      handlePointerDown,
    );
    state.renderer.domElement.addEventListener(
      "pointermove",
      handlePointerMove,
    );
    state.renderer.domElement.addEventListener("pointerup", handlePointerUp);
    state.renderer.domElement.addEventListener(
      "pointercancel",
      handlePointerUp,
    );

    return () => {
      window.cancelAnimationFrame(state.animationFrame);
      window.removeEventListener("resize", handleResize);
      state.renderer.domElement.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
      state.renderer.domElement.removeEventListener(
        "pointermove",
        handlePointerMove,
      );
      state.renderer.domElement.removeEventListener(
        "pointerup",
        handlePointerUp,
      );
      state.renderer.domElement.removeEventListener(
        "pointercancel",
        handlePointerUp,
      );
      state.renderer.dispose();
      state.renderer.domElement.remove();
      stateRef.current = null;
    };
  }, [onInkChange]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    applyCamera(state.camera, cameraConfig);
  }, [cameraConfig]);

  return (
    <>
      <div
        ref={containerRef}
        className="bench-canvas"
        aria-label="Optical bench drawing surface"
      />
      {debug ? (
        <CameraDebugControls
          cameraConfig={cameraConfig}
          setCameraConfig={setCameraConfig}
        />
      ) : null}
    </>
  );
});
