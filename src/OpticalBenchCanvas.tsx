import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

export type OpticalBenchHandle = {
  clear: () => void;
};

type Point = {
  x: number;
  y: number;
};

type Plane = {
  x: number;
  y: number;
  w: number;
  h: number;
  skew: number;
  depth: number;
};

type DrawState = {
  activePointerId: number | null;
  lastPoint: Point | null;
  hasInk: boolean;
  targetConfidence: number[];
  smoothConfidence: number[];
};

const VIEW_W = 1440;
const VIEW_H = 810;
const INPUT_W = 180;
const INPUT_H = 240;
const PATTERN_SIZE = 160;

const planes: Plane[] = [
  { x: 194, y: 272, w: 180, h: 240, skew: -34, depth: 0 },
  { x: 492, y: 246, w: 132, h: 290, skew: -28, depth: 1 },
  { x: 667, y: 238, w: 132, h: 306, skew: -20, depth: 2 },
  { x: 842, y: 238, w: 132, h: 306, skew: -12, depth: 3 },
  { x: 1017, y: 246, w: 132, h: 290, skew: -5, depth: 4 },
  { x: 1238, y: 270, w: 122, h: 246, skew: 8, depth: 5 },
];

const digitAnchors: Point[] = [
  { x: 0.5, y: 0.22 },
  { x: 0.5, y: 0.32 },
  { x: 0.5, y: 0.42 },
  { x: 0.5, y: 0.52 },
  { x: 0.5, y: 0.62 },
  { x: 0.5, y: 0.72 },
  { x: 0.5, y: 0.82 },
  { x: 0.28, y: 0.5 },
  { x: 0.72, y: 0.5 },
  { x: 0.5, y: 0.5 },
];

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function planeCorners(plane: Plane): [Point, Point, Point, Point] {
  return [
    { x: plane.x + plane.skew, y: plane.y },
    { x: plane.x + plane.skew + plane.w, y: plane.y },
    { x: plane.x - plane.skew + plane.w, y: plane.y + plane.h },
    { x: plane.x - plane.skew, y: plane.y + plane.h },
  ];
}

function tracePlane(ctx: CanvasRenderingContext2D, plane: Plane) {
  const [a, b, c, d] = planeCorners(plane);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
}

function planeCenter(plane: Plane): Point {
  return {
    x: plane.x + plane.w / 2,
    y: plane.y + plane.h / 2,
  };
}

function mapToPlane(point: Point, plane: Plane): Point | null {
  const [a, b, , d] = planeCorners(plane);
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const ux = d.x - a.x;
  const uy = d.y - a.y;
  const px = point.x - a.x;
  const py = point.y - a.y;
  const det = vx * uy - vy * ux;
  if (Math.abs(det) < 0.001) return null;

  const s = (px * uy - py * ux) / det;
  const t = (vx * py - vy * px) / det;
  if (s < 0 || s > 1 || t < 0 || t > 1) return null;

  return { x: s * INPUT_W, y: t * INPUT_H };
}

function setupCanvasSize(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable.");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function clearDrawing(drawCanvas: HTMLCanvasElement) {
  const ctx = drawCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function drawInkStroke(
  drawCanvas: HTMLCanvasElement,
  from: Point | null,
  to: Point,
) {
  const ctx = drawCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(245, 255, 255, 0.96)";
  ctx.shadowColor = "rgba(145, 238, 255, 0.55)";
  ctx.shadowBlur = 10;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(from?.x ?? to.x, from?.y ?? to.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createRadialGradient(760, 350, 90, 760, 390, 810);
  gradient.addColorStop(0, "#10252b");
  gradient.addColorStop(0.48, "#071114");
  gradient.addColorStop(1, "#020405");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const table = ctx.createLinearGradient(0, 610, 0, VIEW_H);
  table.addColorStop(0, "rgba(42, 54, 56, 0.26)");
  table.addColorStop(1, "rgba(2, 4, 5, 0.8)");
  ctx.fillStyle = table;
  ctx.fillRect(0, 610, VIEW_W, 200);
}

function drawGlassBody(ctx: CanvasRenderingContext2D, plane: Plane, index: number) {
  tracePlane(ctx, plane);
  const glass = ctx.createLinearGradient(plane.x, plane.y, plane.x + plane.w, plane.y + plane.h);
  glass.addColorStop(0, "rgba(200, 252, 255, 0.05)");
  glass.addColorStop(0.45, "rgba(220, 255, 255, 0.14)");
  glass.addColorStop(1, "rgba(91, 183, 200, 0.05)");
  ctx.fillStyle = glass;
  ctx.fill();

  tracePlane(ctx, plane);
  ctx.lineWidth = index === 0 ? 2.4 : 1.8;
  ctx.strokeStyle = index === 0 ? "rgba(215, 255, 255, 0.72)" : "rgba(175, 247, 255, 0.48)";
  ctx.shadowColor = "rgba(128, 232, 255, 0.28)";
  ctx.shadowBlur = 18;
  ctx.stroke();

  ctx.save();
  tracePlane(ctx, plane);
  ctx.clip();
  ctx.globalAlpha = index === 0 ? 0.16 : 0.28;
  ctx.strokeStyle = "rgba(223, 255, 255, 0.42)";
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 18; i += 1) {
    const y = plane.y + 18 + i * 16 + Math.sin(i * 1.7 + index) * 5;
    ctx.beginPath();
    for (let x = plane.x - 52; x < plane.x + plane.w + 58; x += 8) {
      const wave =
        Math.sin(x * 0.035 + i * 0.65 + index * 1.8) * 4 +
        Math.sin(x * 0.071 + index * 2.1) * 2;
      if (x === plane.x - 52) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawInputOnPlane(
  ctx: CanvasRenderingContext2D,
  plane: Plane,
  drawCanvas: HTMLCanvasElement,
  hasInk: boolean,
) {
  ctx.save();
  tracePlane(ctx, plane);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";

  if (hasInk) {
    ctx.globalAlpha = 0.92;
    ctx.drawImage(drawCanvas, plane.x - plane.skew, plane.y, plane.w, plane.h);
    ctx.filter = "blur(8px)";
    ctx.globalAlpha = 0.46;
    ctx.drawImage(drawCanvas, plane.x - plane.skew - 4, plane.y - 4, plane.w + 8, plane.h + 8);
    ctx.filter = "none";
  } else {
    const idle = ctx.createRadialGradient(
      plane.x + plane.w * 0.5,
      plane.y + plane.h * 0.48,
      8,
      plane.x + plane.w * 0.5,
      plane.y + plane.h * 0.5,
      120,
    );
    idle.addColorStop(0, "rgba(190, 248, 255, 0.1)");
    idle.addColorStop(1, "rgba(190, 248, 255, 0)");
    ctx.fillStyle = idle;
    ctx.fillRect(plane.x - 24, plane.y - 24, plane.w + 48, plane.h + 48);
  }
  ctx.restore();
}

function seedNoise(x: number, y: number, layer: number) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + layer * 41.17) * 43758.5453;
  return v - Math.floor(v);
}

function renderPattern(
  target: HTMLCanvasElement,
  drawCanvas: HTMLCanvasElement,
  layer: number,
  hasInk: boolean,
) {
  const ctx = target.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, target.width, target.height);

  if (!hasInk) {
    const idle = ctx.createRadialGradient(80, 80, 4, 80, 80, 86);
    idle.addColorStop(0, "rgba(202, 255, 255, 0.2)");
    idle.addColorStop(1, "rgba(202, 255, 255, 0)");
    ctx.fillStyle = idle;
    ctx.fillRect(0, 0, target.width, target.height);
    return;
  }

  const sample = makeCanvas(PATTERN_SIZE, PATTERN_SIZE);
  const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
  if (!sampleCtx) return;
  sampleCtx.drawImage(drawCanvas, 0, 0, PATTERN_SIZE, PATTERN_SIZE);
  const input = sampleCtx.getImageData(0, 0, PATTERN_SIZE, PATTERN_SIZE).data;
  const output = ctx.createImageData(PATTERN_SIZE, PATTERN_SIZE);

  for (let y = 0; y < PATTERN_SIZE; y += 1) {
    for (let x = 0; x < PATTERN_SIZE; x += 1) {
      const nx = x / PATTERN_SIZE - 0.5;
      const ny = y / PATTERN_SIZE - 0.5;
      const radius = Math.hypot(nx, ny);
      const angle = Math.atan2(ny, nx);
      const warp = layer * 7.5;
      const sx = Math.max(
        0,
        Math.min(
          PATTERN_SIZE - 1,
          Math.round(x + Math.sin(angle * (layer + 2) + radius * 19) * warp),
        ),
      );
      const sy = Math.max(
        0,
        Math.min(
          PATTERN_SIZE - 1,
          Math.round(y + Math.cos(angle * (layer + 1) - radius * 17) * warp),
        ),
      );
      const source = input[(sy * PATTERN_SIZE + sx) * 4 + 3] / 255;
      const ripple = 0.5 + 0.5 * Math.sin(radius * (35 + layer * 18) - angle * (layer + 1));
      const fringe = 0.5 + 0.5 * Math.sin((nx * 42 - ny * 26) * (0.45 + layer * 0.18));
      const speckle = seedNoise(x, y, layer);
      const gather =
        layer < 4
          ? 1
          : Math.max(
              0,
              1.1 -
                Math.min(
                  ...digitAnchors.map((anchor) =>
                    Math.hypot(x / PATTERN_SIZE - anchor.x, y / PATTERN_SIZE - anchor.y),
                  ),
                ) *
                  5.4,
            );
      const glow = Math.min(
        1,
        source * (0.42 + ripple * 0.34 + fringe * 0.28) +
          Math.pow(source, 0.5) * speckle * 0.18 +
          gather * source * 0.55,
      );
      const i = (y * PATTERN_SIZE + x) * 4;
      output.data[i] = 150 + Math.round(glow * 105);
      output.data[i + 1] = 225 + Math.round(glow * 30);
      output.data[i + 2] = 255;
      output.data[i + 3] = Math.round(Math.min(1, glow * (0.2 + layer * 0.12)) * 255);
    }
  }

  ctx.putImageData(output, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = `blur(${2 + layer}px)`;
  ctx.globalAlpha = 0.58;
  ctx.drawImage(target, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

function drawPatternOnPlane(
  ctx: CanvasRenderingContext2D,
  plane: Plane,
  pattern: HTMLCanvasElement,
  layer: number,
) {
  ctx.save();
  tracePlane(ctx, plane);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.78;
  ctx.drawImage(pattern, plane.x - plane.skew, plane.y, plane.w, plane.h);
  ctx.filter = `blur(${4 + layer}px)`;
  ctx.globalAlpha = 0.32;
  ctx.drawImage(pattern, plane.x - plane.skew - 7, plane.y - 7, plane.w + 14, plane.h + 14);
  ctx.restore();
}

function drawGuidingBeam(ctx: CanvasRenderingContext2D, from: Plane, to: Plane, power: number) {
  const a = planeCenter(from);
  const b = planeCenter(to);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  gradient.addColorStop(0, `rgba(134, 236, 255, ${0.02 + power * 0.06})`);
  gradient.addColorStop(0.5, `rgba(238, 255, 255, ${0.05 + power * 0.12})`);
  gradient.addColorStop(1, `rgba(134, 236, 255, ${0.02 + power * 0.06})`);
  ctx.strokeStyle = gradient;
  ctx.lineCap = "round";
  for (let i = -2; i <= 2; i += 1) {
    ctx.lineWidth = 2.5 - Math.abs(i) * 0.25;
    ctx.beginPath();
    ctx.moveTo(a.x + i * 5, a.y - 62 + i * 8);
    ctx.bezierCurveTo(
      a.x + 95,
      a.y - 48 + i * 11,
      b.x - 95,
      b.y - 46 - i * 6,
      b.x + i * 4,
      b.y - 52 - i * 7,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function measureInk(drawCanvas: HTMLCanvasElement) {
  const ctx = drawCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const image = ctx.getImageData(0, 0, drawCanvas.width, drawCanvas.height).data;
  let mass = 0;
  let cx = 0;
  let cy = 0;
  let left = drawCanvas.width;
  let right = 0;
  let top = drawCanvas.height;
  let bottom = 0;

  for (let y = 0; y < drawCanvas.height; y += 4) {
    for (let x = 0; x < drawCanvas.width; x += 4) {
      const alpha = image[(y * drawCanvas.width + x) * 4 + 3] / 255;
      if (alpha <= 0.04) continue;
      mass += alpha;
      cx += x * alpha;
      cy += y * alpha;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (mass <= 0) return null;
  cx /= mass;
  cy /= mass;
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  return {
    mass,
    cx: cx / drawCanvas.width,
    cy: cy / drawCanvas.height,
    aspect: width / height,
    fill: mass / ((width * height) / 16),
    vertical: height / drawCanvas.height,
  };
}

function estimateConfidence(drawCanvas: HTMLCanvasElement) {
  const features = measureInk(drawCanvas);
  if (!features) return Array.from({ length: 10 }, () => 0.04);

  const raw = [
    0.56 + Math.abs(features.aspect - 0.8) * -0.28 + features.fill * 0.05,
    0.5 + (features.aspect < 0.48 ? 0.38 : -0.1) + features.vertical * 0.12,
    0.45 + (features.cy < 0.52 ? 0.12 : 0) + Math.abs(features.aspect - 0.76) * -0.18,
    0.48 + (features.cx > 0.5 ? 0.13 : 0) + Math.abs(features.aspect - 0.72) * -0.16,
    0.4 + (features.cx < 0.5 ? 0.16 : 0) + (features.aspect > 0.7 ? 0.08 : 0),
    0.46 + (features.cy > 0.48 ? 0.12 : 0) + Math.abs(features.aspect - 0.7) * -0.18,
    0.42 + (features.cy > 0.54 ? 0.2 : 0) + features.fill * 0.14,
    0.44 + (features.aspect < 0.56 ? 0.18 : 0) + (features.cy < 0.5 ? 0.08 : 0),
    0.54 + features.fill * 0.2 + Math.abs(features.aspect - 0.68) * -0.18,
    0.46 + (features.cx > 0.5 ? 0.1 : 0) + (features.cy < 0.5 ? 0.1 : 0),
  ];

  const max = Math.max(...raw);
  const exp = raw.map((value) => Math.exp((value - max) * 7));
  const sum = exp.reduce((total, value) => total + value, 0);
  return exp.map((value) => value / sum);
}

function drawDetectorArray(
  ctx: CanvasRenderingContext2D,
  plane: Plane,
  confidence: number[],
  hasInk: boolean,
) {
  drawGlassBody(ctx, plane, 5);

  const rows = 10;
  const x = plane.x + plane.w * 0.5;
  const y0 = plane.y + 23;
  const gap = (plane.h - 46) / (rows - 1);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let digit = 0; digit < rows; digit += 1) {
    const strength = hasInk ? confidence[digit] : 0.045;
    const y = y0 + gap * digit;
    const radius = 4 + strength * 18;
    const glow = ctx.createRadialGradient(x, y, 1, x, y, radius * 2.9);
    glow.addColorStop(0, `rgba(255, 255, 255, ${0.2 + strength * 0.72})`);
    glow.addColorStop(0.24, `rgba(169, 247, 255, ${0.18 + strength * 0.55})`);
    glow.addColorStop(0.7, `rgba(92, 192, 255, ${strength * 0.18})`);
    glow.addColorStop(1, "rgba(92, 192, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(233, 255, 255, ${0.16 + strength * 0.72})`;
    ctx.beginPath();
    ctx.arc(x, y, 3 + strength * 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(210, 238, 240, ${0.36 + strength * 0.5})`;
    ctx.font = "18px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(digit), x - 24, y + 0.5);
    ctx.globalCompositeOperation = "lighter";
  }
  ctx.restore();
}

function renderScene(
  ctx: CanvasRenderingContext2D,
  drawCanvas: HTMLCanvasElement,
  patternCanvases: HTMLCanvasElement[],
  state: DrawState,
  dt: number,
) {
  drawBackground(ctx);

  const target = state.hasInk ? estimateConfidence(drawCanvas) : Array.from({ length: 10 }, () => 0.04);
  state.targetConfidence = target;
  const smoothing = Math.min(1, dt / 340);
  state.smoothConfidence = state.smoothConfidence.map(
    (value, index) => value + (state.targetConfidence[index] - value) * smoothing,
  );

  for (let i = 0; i < patternCanvases.length; i += 1) {
    renderPattern(patternCanvases[i], drawCanvas, i + 1, state.hasInk);
  }

  const power = state.hasInk ? 1 : 0.2;
  for (let i = 0; i < planes.length - 1; i += 1) {
    drawGuidingBeam(ctx, planes[i], planes[i + 1], power);
  }

  drawGlassBody(ctx, planes[0], 0);
  drawInputOnPlane(ctx, planes[0], drawCanvas, state.hasInk);

  for (let i = 1; i <= 4; i += 1) {
    drawGlassBody(ctx, planes[i], i);
    drawPatternOnPlane(ctx, planes[i], patternCanvases[i - 1], i);
  }

  drawDetectorArray(ctx, planes[5], state.smoothConfidence, state.hasInk);
}

function eventToViewPoint(canvas: HTMLCanvasElement, event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEW_W,
    y: ((event.clientY - rect.top) / rect.height) * VIEW_H,
  };
}

export const OpticalBenchCanvas = forwardRef<
  OpticalBenchHandle,
  { onInkChange: (hasInk: boolean) => void }
>(function OpticalBenchCanvas({ onInkChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvas = useMemo(() => makeCanvas(INPUT_W, INPUT_H), []);
  const patternCanvases = useMemo(
    () => Array.from({ length: 4 }, () => makeCanvas(PATTERN_SIZE, PATTERN_SIZE)),
    [],
  );
  const stateRef = useRef<DrawState>({
    activePointerId: null,
    lastPoint: null,
    hasInk: false,
    targetConfidence: Array.from({ length: 10 }, () => 0.04),
    smoothConfidence: Array.from({ length: 10 }, () => 0.04),
  });

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        clearDrawing(drawCanvas);
        stateRef.current.hasInk = false;
        stateRef.current.lastPoint = null;
        stateRef.current.targetConfidence = Array.from({ length: 10 }, () => 0.04);
        onInkChange(false);
      },
    }),
    [drawCanvas, onInkChange],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrame = 0;
    let lastTime = performance.now();

    const render = (time: number) => {
      const { ctx, width, height } = setupCanvasSize(canvas);
      const scale = Math.min(width / VIEW_W, height / VIEW_H);
      const x = (width - VIEW_W * scale) / 2;
      const y = (height - VIEW_H * scale) / 2;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      renderScene(ctx, drawCanvas, patternCanvases, stateRef.current, time - lastTime);
      ctx.restore();

      lastTime = time;
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [drawCanvas, patternCanvases]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toLocalInput = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
      const offsetX = (rect.width - VIEW_W * scale) / 2;
      const offsetY = (rect.height - VIEW_H * scale) / 2;
      const viewPoint = eventToViewPoint(canvas, event);
      const corrected = {
        x: (event.clientX - rect.left - offsetX) / scale,
        y: (event.clientY - rect.top - offsetY) / scale,
      };
      return mapToPlane(Number.isFinite(corrected.x) ? corrected : viewPoint, planes[0]);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const point = toLocalInput(event);
      if (!point) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      stateRef.current.activePointerId = event.pointerId;
      stateRef.current.lastPoint = point;
      drawInkStroke(drawCanvas, null, point);
      stateRef.current.hasInk = true;
      onInkChange(true);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (stateRef.current.activePointerId !== event.pointerId) return;
      const point = toLocalInput(event);
      if (!point) return;
      event.preventDefault();
      drawInkStroke(drawCanvas, stateRef.current.lastPoint, point);
      stateRef.current.lastPoint = point;
      stateRef.current.hasInk = true;
      onInkChange(true);
    };

    const endPointer = (event: PointerEvent) => {
      if (stateRef.current.activePointerId !== event.pointerId) return;
      stateRef.current.activePointerId = null;
      stateRef.current.lastPoint = null;
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", endPointer);
      canvas.removeEventListener("pointercancel", endPointer);
    };
  }, [drawCanvas, onInkChange]);

  return <canvas ref={canvasRef} className="bench-canvas" aria-label="Optical bench drawing surface" />;
});
