import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { CameraDebugControls } from "./opticalBench/CameraDebugControls";
import {
  DEFAULT_HIDDEN_DEBUG_TAP_CONFIG,
  distanceBetween,
  dollyCamera,
  midpoint,
  orbitCamera,
  panCamera,
  pointerPoint,
  updateHiddenDebugTap,
  type HiddenDebugTapState,
} from "./opticalBench/cameraControls";
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
  sampleInputMask,
  sampleInputLight,
} from "./opticalBench/textures";
import type { CameraConfig, Point, SceneState } from "./opticalBench/types";

const DEBUG_STORAGE_KEY = "diffractive-neural-network-debug";

type DebugPointerState = {
  pointers: Map<number, Point>;
  lastSinglePoint: Point | null;
  lastMultiCenter: Point | null;
  lastPinchDistance: number | null;
};

function readStoredDebugMode() {
  return window.localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
}

function persistDebugMode(debug: boolean) {
  window.localStorage.setItem(DEBUG_STORAGE_KEY, debug ? "1" : "0");
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
  const debugPointerStateRef = useRef<DebugPointerState>({
    pointers: new Map(),
    lastSinglePoint: null,
    lastMultiCenter: null,
    lastPinchDistance: null,
  });
  const hiddenDebugTapRef = useRef<HiddenDebugTapState>({
    count: 0,
    firstTapAt: 0,
  });
  const debugRef = useRef(false);
  const cameraConfigRef = useRef<CameraConfig>(DEFAULT_CAMERA);
  const cameraAdjustedRef = useRef(false);
  const supportsPointerEvents = useMemo(() => "PointerEvent" in window, []);
  const [debug, setDebug] = useState(readStoredDebugMode);
  const [cameraConfig, setCameraConfig] = useState<CameraConfig>(() =>
    getResponsiveCamera(window.innerWidth, window.innerHeight),
  );
  const [cameraAdjusted, setCameraAdjusted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(shouldOpenPanelInitially);
  const [hasInk, setHasInk] = useState(false);

  const setAdjustedCameraConfig = useCallback(
    (config: SetStateAction<CameraConfig>) => {
      cameraAdjustedRef.current = true;
      setCameraAdjusted(true);
      setCameraConfig((currentConfig) => {
        const nextConfig =
          typeof config === "function" ? config(currentConfig) : config;
        cameraConfigRef.current = nextConfig;
        return nextConfig;
      });
    },
    [],
  );

  const toggleDebug = useCallback(() => {
    setDebug((current) => {
      const next = !current;
      persistDebugMode(next);
      if (next) setPanelOpen(false);
      return next;
    });
  }, []);

  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);

  useEffect(() => {
    debugRef.current = debug;
  }, [debug]);

  useEffect(() => {
    cameraConfigRef.current = cameraConfig;
  }, [cameraConfig]);

  useEffect(() => {
    cameraAdjustedRef.current = cameraAdjusted;
  }, [cameraAdjusted]);

  const resizeBench = useCallback(() => {
    const container = containerRef.current;
    const state = stateRef.current;
    if (!container || !state) return;
    resize(container, state);
    if (cameraAdjustedRef.current) {
      applyCamera(state.camera, cameraConfigRef.current);
      return;
    }

    const responsiveCamera = getResponsiveCamera(
      container.clientWidth,
      container.clientHeight,
    );
    cameraConfigRef.current = responsiveCamera;
    setCameraConfig(responsiveCamera);
    applyCamera(state.camera, responsiveCamera);
  }, []);

  const clear = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    resetInputCanvas(state.inputCanvas);
    state.inputTexture.needsUpdate = true;
    state.hasInk = false;
    state.normalizedInput = null;
    state.classificationRequestId += 1;
    state.classificationQueued = false;
    state.confidence = Array(DIGITS).fill(0);
    state.targetConfidence = Array(DIGITS).fill(0);
    state.inputLightSamples = sampleInputLight(null);
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
    state.normalizedInput = sampleInputMask(state.inputCanvas);
    state.inputLightSamples = sampleInputLight(state.normalizedInput);
    state.hasInk = true;
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

  const openDrawingPanel = useCallback(() => {
    syncDrawingPanelCanvas(drawingCanvasRef.current, stateRef.current);
    setPanelOpen(true);
  }, []);

  const toggleDrawingPanel = useCallback(() => {
    if (panelOpenRef.current) {
      setPanelOpen(false);
      return;
    }
    openDrawingPanel();
  }, [openDrawingPanel]);

  const resetCamera = useCallback(() => {
    const container = containerRef.current;
    const state = stateRef.current;
    const responsiveCamera = container
      ? getResponsiveCamera(container.clientWidth, container.clientHeight)
      : DEFAULT_CAMERA;
    cameraAdjustedRef.current = false;
    cameraConfigRef.current = responsiveCamera;
    setCameraAdjusted(false);
    setCameraConfig(responsiveCamera);
    if (state) applyCamera(state.camera, responsiveCamera);
  }, []);

  const updateDebugCameraFromPointerMove = useCallback(
    (container: HTMLDivElement, event: PointerEvent) => {
      const debugPointerState = debugPointerStateRef.current;
      if (!debugPointerState.pointers.has(event.pointerId)) return;

      debugPointerState.pointers.set(event.pointerId, pointerPoint(event));
      const pointers = Array.from(debugPointerState.pointers.values());

      if (pointers.length === 1) {
        const point = pointers[0];
        const previousPoint = debugPointerState.lastSinglePoint;
        debugPointerState.lastSinglePoint = point;
        debugPointerState.lastMultiCenter = null;
        debugPointerState.lastPinchDistance = null;
        if (!previousPoint) return;

        setAdjustedCameraConfig((config) =>
          orbitCamera(
            config,
            point.x - previousPoint.x,
            point.y - previousPoint.y,
          ),
        );
        return;
      }

      if (pointers.length < 2) return;

      const center = midpoint(pointers[0], pointers[1]);
      const pinchDistance = distanceBetween(pointers[0], pointers[1]);
      const previousCenter = debugPointerState.lastMultiCenter;
      const previousDistance = debugPointerState.lastPinchDistance;
      debugPointerState.lastSinglePoint = null;
      debugPointerState.lastMultiCenter = center;
      debugPointerState.lastPinchDistance = pinchDistance;
      if (!previousCenter || previousDistance === null) return;

      setAdjustedCameraConfig((config) => {
        const panned = panCamera(
          config,
          center.x - previousCenter.x,
          center.y - previousCenter.y,
          container.clientHeight,
        );
        return dollyCamera(panned, previousDistance - pinchDistance);
      });
    },
    [setAdjustedCameraConfig],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const state = createScene(
      container,
      setHasInk,
      cameraAdjustedRef.current
        ? cameraConfigRef.current
        : getResponsiveCamera(container.clientWidth, container.clientHeight),
    );
    stateRef.current = state;
    resizeBench();
    animate(state);
    syncDrawingPanelCanvas(drawingCanvasRef.current, state);

    const handleResize = () => resizeBench();
    const handlePointerDown = (event: PointerEvent | MouseEvent) => {
      if (
        debugRef.current &&
        supportsPointerEvents &&
        event instanceof PointerEvent
      ) {
        event.preventDefault();
        debugPointerStateRef.current.pointers.set(
          event.pointerId,
          pointerPoint(event),
        );
        state.renderer.domElement.setPointerCapture(event.pointerId);
        return;
      }
      if (debugRef.current) return;
      if (panelOpenRef.current) return;
      if (!hitsInputSurface(event, container, state)) return;
      event.preventDefault();
      syncDrawingPanelCanvas(drawingCanvasRef.current, state);
      setPanelOpen(true);
    };
    const handlePointerMove = (event: PointerEvent | MouseEvent) => {
      if (
        debugRef.current &&
        supportsPointerEvents &&
        event instanceof PointerEvent
      ) {
        event.preventDefault();
        updateDebugCameraFromPointerMove(container, event);
        return;
      }
      if (debugRef.current) return;
      state.renderer.domElement.style.cursor =
        !panelOpenRef.current && hitsInputSurface(event, container, state)
          ? "pointer"
          : "default";
    };
    const handlePointerEnd = (event: PointerEvent) => {
      if (!debugRef.current) return;
      const debugPointerState = debugPointerStateRef.current;
      debugPointerState.pointers.delete(event.pointerId);
      debugPointerState.lastSinglePoint = null;
      debugPointerState.lastMultiCenter = null;
      debugPointerState.lastPinchDistance = null;
      if (state.renderer.domElement.hasPointerCapture(event.pointerId)) {
        state.renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };
    const handleWheel = (event: WheelEvent) => {
      if (!debugRef.current) return;
      event.preventDefault();
      setAdjustedCameraConfig((config) =>
        dollyCamera(config, event.deltaY * 0.1),
      );
    };
    const downEvent = supportsPointerEvents ? "pointerdown" : "mousedown";
    const moveEvent = supportsPointerEvents ? "pointermove" : "mousemove";

    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    state.renderer.domElement.addEventListener(downEvent, handlePointerDown);
    state.renderer.domElement.addEventListener(moveEvent, handlePointerMove);
    state.renderer.domElement.addEventListener("pointerup", handlePointerEnd);
    state.renderer.domElement.addEventListener(
      "pointercancel",
      handlePointerEnd,
    );
    state.renderer.domElement.addEventListener("wheel", handleWheel, {
      passive: false,
    });

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
      state.renderer.domElement.removeEventListener(
        "pointerup",
        handlePointerEnd,
      );
      state.renderer.domElement.removeEventListener(
        "pointercancel",
        handlePointerEnd,
      );
      state.renderer.domElement.removeEventListener("wheel", handleWheel);
      state.renderer.dispose();
      state.renderer.domElement.remove();
      stateRef.current = null;
    };
  }, [
    resizeBench,
    setAdjustedCameraConfig,
    supportsPointerEvents,
    updateDebugCameraFromPointerMove,
  ]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    if (debugRef.current) applyCamera(state.camera, cameraConfig);
  }, [cameraConfig]);

  useEffect(() => {
    syncDrawingPanelCanvas(drawingCanvasRef.current, stateRef.current);
  }, [panelOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.shiftKey &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "d"
      ) {
        event.preventDefault();
        toggleDebug();
        return;
      }

      if (event.key !== "Escape" || !panelOpenRef.current) return;
      setPanelOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleDebug]);

  useEffect(() => {
    const handlePointerUp = (event: PointerEvent) => {
      const result = updateHiddenDebugTap(
        hiddenDebugTapRef.current,
        pointerPoint(event),
        window.performance.now(),
        DEFAULT_HIDDEN_DEBUG_TAP_CONFIG,
      );
      hiddenDebugTapRef.current = result.state;
      if (!result.shouldToggle) return;
      toggleDebug();
    };

    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [toggleDebug]);

  return (
    <>
      <div
        ref={containerRef}
        className={`bench-canvas${debug ? " bench-canvas--debug" : ""}`}
        aria-label="Depth-aligned optical bench"
      />
      <button
        className={`drawing-panel-toggle${
          panelOpen ? " drawing-panel-toggle--open" : ""
        }`}
        type="button"
        aria-label={panelOpen ? "Close drawing panel" : "Open drawing panel"}
        title={panelOpen ? "Close drawing panel" : "Open drawing panel"}
        onClick={toggleDrawingPanel}
      >
        {panelOpen ? "Close" : "Draw"}
      </button>
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
        {hasInk ? (
          <button
            className="drawing-panel__clear"
            type="button"
            aria-label="Clear drawing"
            title="Clear drawing"
            onClick={clear}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              focusable="false"
              className="drawing-panel__clear-icon"
            >
              <path d="M16.6 3.9a2.1 2.1 0 0 1 3 3l-8.8 8.8a2.4 2.4 0 0 1-3.4 0l-3-3a2.1 2.1 0 0 1 0-3z" />
              <path d="m7.1 15.4 1.5 1.5h8.9" />
              <path d="M13.2 7.3 17 11.1" />
            </svg>
          </button>
        ) : null}
      </section>
      {debug ? (
        <CameraDebugControls
          cameraConfig={cameraConfig}
          setCameraConfig={setAdjustedCameraConfig}
          onResetCamera={resetCamera}
        />
      ) : null}
    </>
  );
}
