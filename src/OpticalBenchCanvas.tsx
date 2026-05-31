import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CameraDebugControls } from "./opticalBench/CameraDebugControls";
import {
  DEFAULT_CAMERA,
  DIGITS,
  getResponsiveCamera,
  INPUT_SIZE,
} from "./opticalBench/constants";
import { requestClassification } from "./opticalBench/confidence";
import { hitsInputSurface } from "./opticalBench/inputSurface";
import {
  animate,
  applyCamera,
  createScene,
  resize,
} from "./opticalBench/scene";
import {
  drawInputStroke,
  resetInputCanvas,
  sampleInputLight,
} from "./opticalBench/textures";
import type { CameraConfig, Point, SceneState } from "./opticalBench/types";

function isDebugMode() {
  return new URLSearchParams(window.location.search).get("debug") === "1";
}

function shouldOpenPanelInitially() {
  return window.matchMedia("(min-width: 860px) and (min-height: 620px)")
    .matches;
}

function syncDrawingPanelCanvas(
  drawingCanvas: HTMLCanvasElement | null,
  state: SceneState | null,
) {
  if (!drawingCanvas || !state) return;
  const ctx = drawingCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  ctx.drawImage(
    state.inputCanvas,
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height,
  );
}

function pointOnDrawingPanel(
  event:
    | ReactPointerEvent<HTMLCanvasElement>
    | ReactMouseEvent<HTMLCanvasElement>,
): Point | null {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * INPUT_SIZE;
  const y = ((event.clientY - rect.top) / rect.height) * INPUT_SIZE;
  const dx = x - INPUT_SIZE / 2;
  const dy = y - INPUT_SIZE / 2;
  if (Math.sqrt(dx * dx + dy * dy) > INPUT_SIZE * 0.48) return null;
  return { x, y };
}

export function OpticalBenchCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<SceneState | null>(null);
  const panelOpenRef = useRef(false);
  const activePanelPointerIdRef = useRef<number | null>(null);
  const lastPanelPointRef = useRef<Point | null>(null);
  const debug = useMemo(isDebugMode, []);
  const supportsPointerEvents = useMemo(() => "PointerEvent" in window, []);
  const [cameraConfig, setCameraConfig] =
    useState<CameraConfig>(DEFAULT_CAMERA);
  const [panelOpen, setPanelOpen] = useState(shouldOpenPanelInitially);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  const resizeBench = useCallback(() => {
    const container = containerRef.current;
    const state = stateRef.current;
    if (!container || !state) return;
    resize(container, state);
    if (!debug) {
      applyCamera(
        state.camera,
        getResponsiveCamera(container.clientWidth, container.clientHeight),
      );
    }
  }, [debug]);

  const clear = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    resetInputCanvas(state.inputCanvas);
    state.inputTexture.needsUpdate = true;
    state.hasInk = false;
    state.classificationRequestId += 1;
    state.classificationQueued = false;
    state.confidence = Array(DIGITS).fill(0);
    state.targetConfidence = Array(DIGITS).fill(0);
    state.inputLightSamples = [];
    state.textureDirty = true;
    state.onInkChange(false);
    activePanelPointerIdRef.current = null;
    lastPanelPointRef.current = null;
    syncDrawingPanelCanvas(drawingCanvasRef.current, state);
  }, []);

  const drawPanelStroke = useCallback((from: Point | null, to: Point) => {
    const state = stateRef.current;
    if (!state) return;
    drawInputStroke(state.inputCanvas, from, to);
    state.inputTexture.needsUpdate = true;
    state.hasInk = true;
    state.inputLightSamples = sampleInputLight(state.inputCanvas);
    state.textureDirty = true;
    requestClassification(state);
    state.onInkChange(true);
    syncDrawingPanelCanvas(drawingCanvasRef.current, state);
  }, []);

  const handlePanelPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const point = pointOnDrawingPanel(event);
      if (!point) return;
      event.preventDefault();
      activePanelPointerIdRef.current = event.pointerId;
      lastPanelPointRef.current = point;
      drawPanelStroke(null, point);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [drawPanelStroke],
  );

  const handlePanelMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      if (supportsPointerEvents) return;
      const point = pointOnDrawingPanel(event);
      if (!point) return;
      event.preventDefault();
      activePanelPointerIdRef.current = -1;
      lastPanelPointRef.current = point;
      drawPanelStroke(null, point);
    },
    [drawPanelStroke, supportsPointerEvents],
  );

  const handlePanelPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (activePanelPointerIdRef.current !== event.pointerId) return;
      const point = pointOnDrawingPanel(event);
      if (!point) {
        lastPanelPointRef.current = null;
        return;
      }
      event.preventDefault();
      drawPanelStroke(lastPanelPointRef.current, point);
      lastPanelPointRef.current = point;
    },
    [drawPanelStroke],
  );

  const handlePanelMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      if (supportsPointerEvents || activePanelPointerIdRef.current !== -1) {
        return;
      }
      const point = pointOnDrawingPanel(event);
      if (!point) {
        lastPanelPointRef.current = null;
        return;
      }
      event.preventDefault();
      drawPanelStroke(lastPanelPointRef.current, point);
      lastPanelPointRef.current = point;
    },
    [drawPanelStroke, supportsPointerEvents],
  );

  const handlePanelPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (activePanelPointerIdRef.current !== event.pointerId) return;
      activePanelPointerIdRef.current = null;
      lastPanelPointRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [],
  );

  const handlePanelMouseEnd = useCallback(() => {
    if (supportsPointerEvents || activePanelPointerIdRef.current !== -1) {
      return;
    }
    activePanelPointerIdRef.current = null;
    lastPanelPointRef.current = null;
  }, [supportsPointerEvents]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const state = createScene(
      container,
      setHasInk,
      debug
        ? DEFAULT_CAMERA
        : getResponsiveCamera(container.clientWidth, container.clientHeight),
    );
    stateRef.current = state;
    resizeBench();
    animate(state);
    syncDrawingPanelCanvas(drawingCanvasRef.current, state);

    const handleResize = () => resizeBench();
    const handlePointerDown = (event: PointerEvent | MouseEvent) => {
      if (panelOpenRef.current) {
        setPanelOpen(false);
        return;
      }
      if (!hitsInputSurface(event, container, state)) return;
      event.preventDefault();
      syncDrawingPanelCanvas(drawingCanvasRef.current, state);
      setPanelOpen(true);
    };
    const handlePointerMove = (event: PointerEvent | MouseEvent) => {
      state.renderer.domElement.style.cursor =
        !panelOpenRef.current && hitsInputSurface(event, container, state)
          ? "pointer"
          : "default";
    };
    const downEvent = supportsPointerEvents ? "pointerdown" : "mousedown";
    const moveEvent = supportsPointerEvents ? "pointermove" : "mousemove";

    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    state.renderer.domElement.addEventListener(downEvent, handlePointerDown);
    state.renderer.domElement.addEventListener(moveEvent, handlePointerMove);

    return () => {
      window.cancelAnimationFrame(state.animationFrame);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      state.renderer.domElement.removeEventListener(
        downEvent,
        handlePointerDown,
      );
      state.renderer.domElement.removeEventListener(
        moveEvent,
        handlePointerMove,
      );
      state.renderer.dispose();
      state.renderer.domElement.remove();
      stateRef.current = null;
    };
  }, [debug, resizeBench, supportsPointerEvents]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    if (debug) applyCamera(state.camera, cameraConfig);
  }, [cameraConfig, debug]);

  useEffect(() => {
    syncDrawingPanelCanvas(drawingCanvasRef.current, stateRef.current);
  }, [panelOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !panelOpenRef.current) return;
      setPanelOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="bench-canvas"
        aria-label="Depth-aligned optical bench"
      />
      <section
        className={`drawing-panel${panelOpen ? " drawing-panel--open" : ""}`}
        aria-label="Drawing panel"
        aria-hidden={!panelOpen}
      >
        <div className="drawing-panel__surface">
          <canvas
            ref={drawingCanvasRef}
            className="drawing-panel__canvas"
            width={INPUT_SIZE}
            height={INPUT_SIZE}
            aria-label="Handwritten input"
            onPointerDown={handlePanelPointerDown}
            onPointerMove={handlePanelPointerMove}
            onPointerUp={handlePanelPointerEnd}
            onPointerCancel={handlePanelPointerEnd}
            onMouseDown={handlePanelMouseDown}
            onMouseMove={handlePanelMouseMove}
            onMouseUp={handlePanelMouseEnd}
            onMouseLeave={handlePanelMouseEnd}
          />
        </div>
        <button
          className="drawing-panel__clear"
          type="button"
          aria-label="Clear drawing"
          title="Clear drawing"
          disabled={!hasInk}
          onClick={clear}
        >
          <span aria-hidden="true">×</span>
        </button>
      </section>
      {debug ? (
        <CameraDebugControls
          cameraConfig={cameraConfig}
          setCameraConfig={setCameraConfig}
        />
      ) : null}
    </>
  );
}
