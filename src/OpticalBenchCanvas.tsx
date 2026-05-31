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
import * as THREE from "three";
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
  sampleInputMask,
  sampleInputLight,
} from "./opticalBench/textures";
import type { CameraConfig, Point, SceneState } from "./opticalBench/types";

const DEBUG_STORAGE_KEY = "diffractive-neural-network-debug";
const HIDDEN_DEBUG_TAP_LIMIT = 5;
const HIDDEN_DEBUG_TAP_ZONE = 64;
const HIDDEN_DEBUG_TAP_WINDOW_MS = 3000;
const ORBIT_SPEED = 0.006;
const PINCH_SPEED = 0.012;

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

function roundCameraValue(value: number) {
  return Number(value.toFixed(3));
}

function vectorFromPoint(point: CameraConfig["position"]) {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function pointFromVector(vector: THREE.Vector3) {
  return {
    x: roundCameraValue(vector.x),
    y: roundCameraValue(vector.y),
    z: roundCameraValue(vector.z),
  };
}

function pointerPoint(event: PointerEvent): Point {
  return { x: event.clientX, y: event.clientY };
}

function distanceBetween(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function cameraBasis(config: CameraConfig) {
  const position = vectorFromPoint(config.position);
  const target = vectorFromPoint(config.target);
  const viewDirection = target.clone().sub(position).normalize();
  const right = viewDirection
    .clone()
    .cross(new THREE.Vector3(0, 1, 0))
    .normalize();
  const up = right.clone().cross(viewDirection).normalize();
  const distance = position.distanceTo(target);

  return { position, target, right, up, viewDirection, distance };
}

function orbitCamera(config: CameraConfig, dx: number, dy: number) {
  const target = vectorFromPoint(config.target);
  const offset = vectorFromPoint(config.position).sub(target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta -= dx * ORBIT_SPEED;
  spherical.phi = THREE.MathUtils.clamp(
    spherical.phi - dy * ORBIT_SPEED,
    0.12,
    Math.PI - 0.12,
  );
  offset.setFromSpherical(spherical);

  return {
    ...config,
    position: pointFromVector(target.clone().add(offset)),
  };
}

function panCamera(
  config: CameraConfig,
  dx: number,
  dy: number,
  height: number,
) {
  const { position, target, right, up, distance } = cameraBasis(config);
  const worldUnitsPerPixel =
    (2 * Math.tan(THREE.MathUtils.degToRad(config.fov) / 2) * distance) /
    Math.max(1, height);
  const shift = right
    .multiplyScalar(-dx * worldUnitsPerPixel)
    .add(up.multiplyScalar(dy * worldUnitsPerPixel));

  return {
    ...config,
    position: pointFromVector(position.add(shift)),
    target: pointFromVector(target.add(shift)),
  };
}

function dollyCamera(config: CameraConfig, delta: number) {
  const { position, target, viewDirection, distance } = cameraBasis(config);
  const nextDistance = THREE.MathUtils.clamp(
    distance * Math.exp(delta * PINCH_SPEED),
    1.2,
    16,
  );
  const nextPosition = target
    .clone()
    .sub(viewDirection.multiplyScalar(nextDistance));

  return {
    ...config,
    position: pointFromVector(nextPosition),
  };
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
  const hiddenDebugTapRef = useRef({ count: 0, firstTapAt: 0 });
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
      if (
        event.clientX > HIDDEN_DEBUG_TAP_ZONE ||
        event.clientY > HIDDEN_DEBUG_TAP_ZONE
      ) {
        return;
      }

      const now = window.performance.now();
      const hiddenDebugTap = hiddenDebugTapRef.current;
      if (now - hiddenDebugTap.firstTapAt > HIDDEN_DEBUG_TAP_WINDOW_MS) {
        hiddenDebugTap.count = 0;
        hiddenDebugTap.firstTapAt = now;
      }

      hiddenDebugTap.count += 1;
      if (hiddenDebugTap.count < HIDDEN_DEBUG_TAP_LIMIT) return;

      hiddenDebugTap.count = 0;
      hiddenDebugTap.firstTapAt = 0;
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
          onOpenDrawingPanel={openDrawingPanel}
          onResetCamera={resetCamera}
        />
      ) : null}
    </>
  );
}
