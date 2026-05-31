import { DIGIT_ANCHORS, DIGITS } from "./constants";
import { circleMask } from "./canvas";
import type { Point } from "./types";

export function resetInputCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawInputStroke(
  canvas: HTMLCanvasElement,
  from: Point | null,
  to: Point,
) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  ctx.save();
  circleMask(ctx, canvas.width);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(27, 128, 150, 0.82)";
  ctx.shadowColor = "rgba(34, 185, 215, 0.45)";
  ctx.shadowBlur = 18;
  ctx.lineWidth = 38;
  ctx.beginPath();
  ctx.moveTo(from?.x ?? to.x, from?.y ?? to.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function strongestDigit(confidence: number[]) {
  let index = 0;
  let value = 0;
  for (let i = 0; i < confidence.length; i += 1) {
    if (confidence[i] <= value) continue;
    index = i;
    value = confidence[i];
  }
  return { index, value };
}

function confidenceDigitFill(strength: number) {
  const lift = Math.pow(Math.max(0, Math.min(1, strength)), 0.55);
  const r = Math.round(32 + lift * 214);
  const g = Math.round(54 + lift * 201);
  const b = Math.round(60 + lift * 195);
  return `rgb(${r}, ${g}, ${b})`;
}

function outputDisplayStrength(confidence: number[], strength: number) {
  const maxConfidence = Math.max(...confidence);
  if (maxConfidence <= 0.0005 || strength <= 0.0005) return 0;
  const contrastStretched = strength / Math.max(maxConfidence, 0.34);
  return Math.min(1, Math.pow(contrastStretched, 0.72));
}

export function drawLensTexture(
  canvas: HTMLCanvasElement,
  source: HTMLCanvasElement,
  confidence: number[],
  layer: number,
  hasInk: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  circleMask(ctx, size);

  const base = ctx.createRadialGradient(
    size * 0.42,
    size * 0.36,
    10,
    size / 2,
    size / 2,
    size * 0.52,
  );
  base.addColorStop(0, "rgba(255, 255, 255, 0.32)");
  base.addColorStop(0.55, "rgba(185, 232, 238, 0.12)");
  base.addColorStop(1, "rgba(118, 176, 188, 0.04)");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = "source-over";
  ctx.lineWidth = 1.15;
  for (let i = 0; i < 36; i += 1) {
    const radius = size * (0.08 + i * 0.0115);
    const phase = layer * 0.8 + i * 0.34;
    ctx.beginPath();
    for (let t = 0; t <= Math.PI * 2 + 0.02; t += 0.035) {
      const wobble =
        Math.sin(t * (2 + layer) + phase) * size * 0.0055 +
        Math.sin(t * 7 - phase * 1.7) * size * 0.0022;
      const r = radius + wobble;
      const x = size / 2 + Math.cos(t) * r;
      const y = size / 2 + Math.sin(t) * r;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const alpha = 0.08 + (i % 3) * 0.028;
    ctx.strokeStyle = `rgba(55, 122, 138, ${alpha})`;
    ctx.stroke();
  }

  if (hasInk) {
    const sourceCtx = source.getContext("2d", { willReadFrequently: true });
    const sourceData = sourceCtx?.getImageData(
      0,
      0,
      source.width,
      source.height,
    );
    const { index: winner, value: winnerStrength } = strongestDigit(confidence);
    const focus = DIGIT_ANCHORS[winner] ?? { x: 0.5, y: 0.5 };
    const layerProgress = layer / 4;

    if (sourceData) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let y = 18; y < source.height - 18; y += 9) {
        for (let x = 18; x < source.width - 18; x += 9) {
          const alpha = sourceData.data[(y * source.width + x) * 4 + 3] / 255;
          if (alpha < 0.06) continue;
          const nx = x / source.width;
          const ny = y / source.height;
          const towardFocusX = (focus.x - nx) * size * layerProgress * 0.38;
          const towardFocusY = (focus.y - ny) * size * layerProgress * 0.38;
          const phase =
            Math.sin(nx * 34 + layer * 1.7) + Math.cos(ny * 29 - layer * 1.3);
          const swirl = (layer * 0.09 + winnerStrength * 0.2) * size;
          const px =
            x +
            towardFocusX +
            Math.cos(phase + layer) * swirl * 0.12 -
            size * 0.5 * layerProgress * 0.04;
          const py =
            y +
            towardFocusY +
            Math.sin(phase - layer) * swirl * 0.12 +
            size * 0.5 * layerProgress * 0.03;
          const radius = 1.4 + alpha * 5.2 + layerProgress * 2.2;
          const glow = ctx.createRadialGradient(px, py, 0, px, py, radius * 6);
          glow.addColorStop(0, `rgba(215, 253, 255, ${0.22 + alpha * 0.34})`);
          glow.addColorStop(0.42, `rgba(93, 196, 217, ${0.07 + alpha * 0.2})`);
          glow.addColorStop(1, "rgba(93, 196, 217, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(px, py, radius * 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    confidence.forEach((strength, digit) => {
      if (strength < 0.025) return;
      const anchor = DIGIT_ANCHORS[digit];
      const x = size * (0.5 + (anchor.x - 0.5) * layerProgress * 0.8);
      const y = size * (0.5 + (anchor.y - 0.5) * layerProgress * 0.8);
      const radius = size * (0.09 + layerProgress * 0.12 + strength * 0.08);
      const alpha = Math.min(0.38, strength * (0.18 + layerProgress * 0.55));
      const glow = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
      glow.addColorStop(0, `rgba(235, 255, 255, ${alpha})`);
      glow.addColorStop(0.55, `rgba(93, 205, 225, ${alpha * 0.4})`);
      glow.addColorStop(1, "rgba(93, 205, 225, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = `rgba(36, 132, 154, ${alpha * 0.7})`;
      ctx.lineWidth = 0.8 + strength * 2.2;
      for (let ring = 0; ring < 3; ring += 1) {
        ctx.beginPath();
        ctx.arc(
          x,
          y,
          radius * (0.34 + ring * 0.22),
          digit * 0.37 + layer,
          digit * 0.37 + layer + Math.PI * (0.8 + strength),
        );
        ctx.stroke();
      }
    });
    ctx.restore();
  } else {
    const idle = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size * 0.42,
    );
    idle.addColorStop(0, "rgba(150, 214, 225, 0.08)");
    idle.addColorStop(1, "rgba(150, 214, 225, 0)");
    ctx.fillStyle = idle;
    ctx.fillRect(0, 0, size, size);
  }

  ctx.restore();
}

export function drawOutputTexture(
  canvas: HTMLCanvasElement,
  confidence: number[],
  hasInk: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#f7fbfc";
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  circleMask(ctx, size);
  const paper = ctx.createRadialGradient(
    size * 0.45,
    size * 0.35,
    20,
    size / 2,
    size / 2,
    size * 0.55,
  );
  paper.addColorStop(0, "#ffffff");
  paper.addColorStop(0.72, "#eef4f5");
  paper.addColorStop(1, "#dfe8ea");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, size, size);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "650 50px Inter, ui-sans-serif, system-ui";

  if (hasInk) {
    for (let digit = 0; digit < DIGITS; digit += 1) {
      const anchor = DIGIT_ANCHORS[digit];
      const x = anchor.x * size;
      const y = anchor.y * size;
      const displayStrength = outputDisplayStrength(
        confidence,
        confidence[digit],
      );
      if (displayStrength <= 0.0005) continue;
      const alpha = 0.14 + displayStrength * 0.86;
      ctx.fillStyle = `rgba(42, 217, 238, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.048, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(21, 137, 163, ${0.26 + displayStrength * 0.42})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  for (let digit = 0; digit < DIGITS; digit += 1) {
    const anchor = DIGIT_ANCHORS[digit];
    const x = anchor.x * size;
    const y = anchor.y * size;
    const strength = hasInk ? confidence[digit] : 0;
    const displayStrength = hasInk
      ? outputDisplayStrength(confidence, strength)
      : 0;
    ctx.lineWidth = hasInk ? 3.4 : 1.8;
    ctx.strokeStyle = hasInk
      ? `rgba(8, 28, 34, ${0.52 + displayStrength * 0.42})`
      : "rgba(36, 52, 56, 0.18)";
    ctx.strokeText(String(digit), x, y);
    ctx.fillStyle = hasInk
      ? confidenceDigitFill(displayStrength)
      : "rgba(36, 52, 56, 0.68)";
    ctx.fillText(String(digit), x, y);
  }

  ctx.strokeStyle = "rgba(88, 120, 128, 0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
