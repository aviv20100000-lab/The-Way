export interface MilestoneShareImageInput {
  id?: string;
  value: number;
  suffix: string;
  message: string;
}

export function milestoneBlobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read milestone image"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read milestone image"));
    reader.readAsDataURL(blob);
  });
}

interface MilestoneShareImageOptions {
  firstName?: string;
}

type MilestoneType = "weight" | "days" | "steps";

export const CARD = {
  canvas: { width: 1080, height: 1920 },
  safeArea: { top: 300, bottom: 1560 },
  colors: {
    backgroundTop: "#080a08",
    backgroundMiddle: "#0c100b",
    backgroundBottom: "#11150f",
    lime: "#c3f400",
    white: "#ffffff",
    valueMiddle: "#f7ffe8",
    valueBottom: "#dcffa3",
    date: "#a3ac8f",
    limeRgb: "195,244,0",
    whiteRgb: "255,255,255",
    blackRgb: "0,0,0",
  },
  textSplit: {
    topColor: "#ffffff",
    topStop: 0.5,
    bottomStop: 0.5,
    bottomColor: "#c3f400",
  },
  background: {
    middleStop: 0.55,
    grain: {
      count: 2200,
      pixelSize: 1,
      whiteAlphaMin: 0.012,
      whiteAlphaRange: 0.013,
      blackAlphaMin: 0.012,
      blackAlphaRange: 0.013,
      alternatingDivisor: 2,
      seed: 2050,
    },
    vignette: {
      x: 620,
      y: 900,
      innerRadius: 0,
      outerRadius: 1120,
      clearStop: 0.58,
      edgeAlpha: 0.22,
    },
  },
  cut: {
    // Direction preserves the original (-100,1320)→(1180,700) diagonal angle
    // (dx=1280, dy=-620). The line is centered on the number's actual
    // measured bounding box at render time (not a hardcoded anchor), and
    // extends symmetrically in both directions, fading out at both ends.
    directionDx: 1280,
    directionDy: -620,
    halfLength: 1600,
    layers: [
      { width: 140, color: "rgba(0,0,0,0.24)" },
      { width: 32, color: "rgba(195,244,0,0.09)" },
      { width: 6, color: "rgba(195,244,0,0.55)" },
    ],
  },
  badge: {
    wordmarkX: 90,
    wordmarkY: 395,
    wordmarkSize: 80,
    wordmarkWeight: 900,
    wordmarkSpacing: 13,
    customA: {
      padding: 16,
      cutWidth: 8,
      sheenWidth: 26,
      sheenAlpha: 0.45,
      lightWidth: 5,
      lightAlpha: 0.98,
      cutStartXRatio: 0.3,
      cutEndXRatio: 0.7,
    },
    signature: {
      whitePoints: [[90, 432], [154, 432], [149, 439], [90, 439]],
      limePoints: [[157, 432], [202, 432], [202, 439], [152, 439]],
      whiteColor: "rgba(255,255,255,0.95)",
    },
  },
  value: {
    x: 930,
    baselineY: 1080,
    singleDigitSize: 630,
    doubleDigitSize: 560,
    tripleDigitSize: 440,
    fontWeight: 900,
    gradientTopRatio: 0.82,
    gradientMiddleStop: 0.58,
    shadowBlur: 18,
    shadowOffsetY: 9,
    shadowColor: "rgba(0,0,0,0.4)",
    glassPadding: 24,
    glassStrokeWidth: 2.5,
    glassStrokeColor: "rgba(255,255,255,0.4)",
    glassHighlightTopAlpha: 0.6,
    glassHighlightMidAlpha: 0.14,
    glassHighlightMidStop: 0.32,
    glassHighlightFadeStop: 0.55,
    fadeStartStop: 0,
    fadeBottomAlpha: 0,
    labelY: 560,
    labelSize: 60,
    labelWeight: 800,
    weightLabel: "ירדתי",
    daysLabel: "תודה על",
    stepsLabel: "הלכתי",
    numberCenterX: 540,
  },
  unit: {
    x: 930,
    baselineY: 1195,
    fontSize: 72,
    fontWeight: 800,
  },
  copy: {
    x: 930,
    firstNameY: 1300,
    firstNameSize: 54,
    firstNameWeight: 700,
    firstNamePrefix: "הדרך של",
    maxWidth: 860,
  },
  brand: {
    x: 930,
    dateY: 1490,
    dateSize: 34,
    dateWeight: 600,
  },
  fontLoads: [
    { weight: 900, size: 660, sample: "100" },
    { weight: 900, size: 80, sample: "THE WAY" },
    { weight: 800, size: 72, sample: "ק״ג אלף צעדים ימים" },
    { weight: 800, size: 60, sample: "ירדתי תודה על הלכתי" },
    { weight: 700, size: 54, sample: "הדרך של אביב" },
    { weight: 600, size: 34, sample: "6 ביולי 2026" },
  ],
} as const;

function resolveFontFamily(): string {
  const fromVariable = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-rubik")
    .trim();
  return fromVariable ? `${fromVariable}, Rubik, sans-serif` : "Rubik, sans-serif";
}

function font(weight: number, size: number, family: string): string {
  return `${weight} ${size}px ${family}`;
}

function createTextSplitGradient(
  ctx: CanvasRenderingContext2D,
  text: string,
  baselineY: number,
  fallbackSize: number
): CanvasGradient {
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || fallbackSize;
  const descent = metrics.actualBoundingBoxDescent;
  const topY = baselineY - ascent;
  const bottomY = baselineY + descent;
  const gradient = ctx.createLinearGradient(0, topY, 0, bottomY);
  gradient.addColorStop(0, CARD.textSplit.topColor);
  gradient.addColorStop(CARD.textSplit.topStop, CARD.textSplit.topColor);
  gradient.addColorStop(CARD.textSplit.bottomStop, CARD.textSplit.bottomColor);
  gradient.addColorStop(1, CARD.textSplit.bottomColor);
  return gradient;
}

function drawSpacedTextFromLeft(
  ctx: CanvasRenderingContext2D,
  text: string,
  startX: number,
  y: number,
  spacing: number
): number {
  let x = startX;
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  [...text].forEach((character) => {
    ctx.fillText(character, x, y);
    x += ctx.measureText(character).width + spacing;
  });
  return x - spacing;
}

function getMilestoneType(milestone: MilestoneShareImageInput): MilestoneType {
  if (milestone.id?.startsWith("steps-")) return "steps";
  if (milestone.id?.startsWith("days-")) return "days";
  return "weight";
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function drawBackgroundBase(ctx: CanvasRenderingContext2D) {
  const { width, height } = CARD.canvas;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, CARD.colors.backgroundTop);
  gradient.addColorStop(CARD.background.middleStop, CARD.colors.backgroundMiddle);
  gradient.addColorStop(1, CARD.colors.backgroundBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
  fill: string | CanvasGradient
) {
  const [firstPoint, ...rest] = points;
  if (!firstPoint) return;
  ctx.beginPath();
  ctx.moveTo(firstPoint[0], firstPoint[1]);
  rest.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function fadeColor(color: string, alphaMultiplier: number): string {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return color;
  const parts = match[1].split(",").map((part) => part.trim());
  const [r, g, b, a = "1"] = parts;
  return `rgba(${r},${g},${b},${Number(a) * alphaMultiplier})`;
}

function drawCut(ctx: CanvasRenderingContext2D, center: { x: number; y: number }) {
  const cut = CARD.cut;
  const magnitude = Math.hypot(cut.directionDx, cut.directionDy);
  const unitX = cut.directionDx / magnitude;
  const unitY = cut.directionDy / magnitude;
  const startX = center.x - unitX * cut.halfLength;
  const startY = center.y - unitY * cut.halfLength;
  const endX = center.x + unitX * cut.halfLength;
  const endY = center.y + unitY * cut.halfLength;

  ctx.save();
  ctx.lineCap = "round";
  cut.layers.forEach((layer) => {
    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, fadeColor(layer.color, 0));
    gradient.addColorStop(0.16, fadeColor(layer.color, 0.85));
    gradient.addColorStop(0.5, layer.color);
    gradient.addColorStop(0.84, fadeColor(layer.color, 0.85));
    gradient.addColorStop(1, fadeColor(layer.color, 0));

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = layer.width;
    ctx.stroke();
  });
  ctx.restore();
}

function drawBackgroundTexture(ctx: CanvasRenderingContext2D) {
  const { width, height } = CARD.canvas;
  const vignetteToken = CARD.background.vignette;
  const vignette = ctx.createRadialGradient(
    vignetteToken.x, vignetteToken.y, vignetteToken.innerRadius,
    vignetteToken.x, vignetteToken.y, vignetteToken.outerRadius
  );
  vignette.addColorStop(vignetteToken.clearStop, `rgba(${CARD.colors.blackRgb},0)`);
  vignette.addColorStop(1, `rgba(${CARD.colors.blackRgb},${vignetteToken.edgeAlpha})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  const grain = CARD.background.grain;
  const random = createSeededRandom(grain.seed);
  for (let index = 0; index < grain.count; index += 1) {
    const isLight = index % grain.alternatingDivisor === 0;
    const alpha = isLight
      ? grain.whiteAlphaMin + random() * grain.whiteAlphaRange
      : grain.blackAlphaMin + random() * grain.blackAlphaRange;
    ctx.fillStyle = isLight
      ? `rgba(${CARD.colors.whiteRgb},${alpha})`
      : `rgba(${CARD.colors.blackRgb},${alpha})`;
    ctx.fillRect(random() * width, random() * height, grain.pixelSize, grain.pixelSize);
  }

}

function drawCustomA(
  ctx: CanvasRenderingContext2D,
  fontFamily: string,
  startX: number,
  baselineY: number
): number {
  const badge = CARD.badge;
  const token = badge.customA;
  ctx.font = font(badge.wordmarkWeight, badge.wordmarkSize, fontFamily);
  const metrics = ctx.measureText("A");
  const glyphWidth = metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || badge.wordmarkSize;
  const descent = metrics.actualBoundingBoxDescent;
  const layer = document.createElement("canvas");
  layer.width = Math.ceil(glyphWidth + token.padding * 2);
  layer.height = Math.ceil(ascent + descent + token.padding * 2);
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) return glyphWidth;

  const localBaselineY = token.padding + ascent;
  const cutStartX = token.padding + glyphWidth * token.cutStartXRatio;
  const cutEndX = token.padding + glyphWidth * token.cutEndXRatio;
  layerCtx.font = font(badge.wordmarkWeight, badge.wordmarkSize, fontFamily);
  layerCtx.textBaseline = "alphabetic";

  // Full, unbroken glyph first — legibility comes before decoration.
  layerCtx.fillStyle = createTextSplitGradient(
    layerCtx,
    "A",
    localBaselineY,
    badge.wordmarkSize
  );
  layerCtx.fillText("A", token.padding, localBaselineY);

  // Broken-line cut through the letter: a real gap in the ink, so the
  // diagonal reads as a physical notch, not just a light reflection.
  layerCtx.globalCompositeOperation = "destination-out";
  layerCtx.lineCap = "butt";
  layerCtx.beginPath();
  layerCtx.moveTo(cutStartX, localBaselineY);
  layerCtx.lineTo(cutEndX, token.padding);
  layerCtx.lineWidth = token.cutWidth;
  layerCtx.stroke();

  // Mirror-like reflection: a soft white sheen plus a crisp lime line,
  // both clipped to the letter's existing ink (source-atop) so the "A"
  // stays fully readable — the diagonal reads as light glinting off glass,
  // not a cut through the letterform.
  layerCtx.globalCompositeOperation = "source-atop";
  layerCtx.lineCap = "round";
  layerCtx.beginPath();
  layerCtx.moveTo(cutStartX, localBaselineY);
  layerCtx.lineTo(cutEndX, token.padding);
  layerCtx.strokeStyle = `rgba(255,255,255,${token.sheenAlpha})`;
  layerCtx.lineWidth = token.sheenWidth;
  layerCtx.stroke();

  layerCtx.beginPath();
  layerCtx.moveTo(cutStartX, localBaselineY);
  layerCtx.lineTo(cutEndX, token.padding);
  layerCtx.strokeStyle = `rgba(${CARD.colors.limeRgb},${token.lightAlpha})`;
  layerCtx.lineWidth = token.lightWidth;
  layerCtx.stroke();
  layerCtx.globalCompositeOperation = "source-over";

  ctx.drawImage(layer, startX - token.padding, baselineY - localBaselineY);
  return glyphWidth;
}

function drawBadge(ctx: CanvasRenderingContext2D, fontFamily: string) {
  const badge = CARD.badge;
  ctx.font = font(badge.wordmarkWeight, badge.wordmarkSize, fontFamily);
  ctx.fillStyle = createTextSplitGradient(ctx, "THE WAY", badge.wordmarkY, badge.wordmarkSize);
  const prefixEndX = drawSpacedTextFromLeft(
    ctx,
    "THE W",
    badge.wordmarkX,
    badge.wordmarkY,
    badge.wordmarkSpacing
  );
  const customAStartX = prefixEndX + badge.wordmarkSpacing;
  const customAWidth = drawCustomA(ctx, fontFamily, customAStartX, badge.wordmarkY);
  drawSpacedTextFromLeft(
    ctx,
    "Y",
    customAStartX + customAWidth + badge.wordmarkSpacing,
    badge.wordmarkY,
    badge.wordmarkSpacing
  );

  drawPolygon(ctx, badge.signature.whitePoints, badge.signature.whiteColor);
  drawPolygon(ctx, badge.signature.limePoints, CARD.colors.lime);
  ctx.textAlign = "right";
  ctx.direction = "rtl";
}

function drawGlassValue(
  ctx: CanvasRenderingContext2D,
  valueText: string,
  valueSize: number,
  valueGradient: CanvasGradient,
  x: number,
  baselineY: number,
  fontFamily: string
) {
  const value = CARD.value;
  const font_ = font(value.fontWeight, valueSize, fontFamily);
  ctx.font = font_;
  const metrics = ctx.measureText(valueText);
  const width = metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || valueSize;
  const descent = metrics.actualBoundingBoxDescent || 0;
  const padding = value.glassPadding;

  const layer = document.createElement("canvas");
  layer.width = Math.ceil(width + padding * 2);
  layer.height = Math.ceil(ascent + descent + padding * 2);
  const layerCtx = layer.getContext("2d");
  if (!layerCtx) return;

  const localX = padding + width / 2;
  const localBaselineY = padding + ascent;

  layerCtx.direction = "ltr";
  layerCtx.textAlign = "center";
  layerCtx.textBaseline = "alphabetic";
  layerCtx.font = font_;
  layerCtx.fillStyle = valueGradient;
  layerCtx.fillText(valueText, localX, localBaselineY);

  layerCtx.strokeStyle = value.glassStrokeColor;
  layerCtx.lineWidth = value.glassStrokeWidth;
  layerCtx.strokeText(valueText, localX, localBaselineY);

  const highlight = layerCtx.createLinearGradient(0, 0, 0, layer.height);
  highlight.addColorStop(0, `rgba(255,255,255,${value.glassHighlightTopAlpha})`);
  highlight.addColorStop(value.glassHighlightMidStop, `rgba(255,255,255,${value.glassHighlightMidAlpha})`);
  highlight.addColorStop(value.glassHighlightFadeStop, "rgba(255,255,255,0)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");

  layerCtx.globalCompositeOperation = "source-atop";
  layerCtx.fillStyle = highlight;
  layerCtx.fillRect(0, 0, layer.width, layer.height);
  layerCtx.globalCompositeOperation = "source-over";

  const fade = layerCtx.createLinearGradient(0, 0, 0, layer.height);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(value.fadeStartStop, "rgba(0,0,0,1)");
  fade.addColorStop(1, `rgba(0,0,0,${value.fadeBottomAlpha})`);
  layerCtx.globalCompositeOperation = "destination-in";
  layerCtx.fillStyle = fade;
  layerCtx.fillRect(0, 0, layer.width, layer.height);
  layerCtx.globalCompositeOperation = "source-over";

  ctx.drawImage(layer, x - width / 2 - padding, baselineY - ascent - padding);
}

function getValueSize(valueText: string): number {
  const value = CARD.value;
  return valueText.length === 1
    ? value.singleDigitSize
    : valueText.length === 2
      ? value.doubleDigitSize
      : value.tripleDigitSize;
}

function getValueMetrics(
  ctx: CanvasRenderingContext2D,
  milestone: MilestoneShareImageInput,
  fontFamily: string
) {
  const value = CARD.value;
  const valueText = String(milestone.value);
  const valueSize = getValueSize(valueText);
  ctx.save();
  ctx.font = font(value.fontWeight, valueSize, fontFamily);
  const metrics = ctx.measureText(valueText);
  ctx.restore();
  return {
    valueText,
    valueSize,
    width: metrics.width,
    ascent: metrics.actualBoundingBoxAscent || valueSize,
    descent: metrics.actualBoundingBoxDescent || 0,
  };
}

function getValueCenter(
  ctx: CanvasRenderingContext2D,
  milestone: MilestoneShareImageInput,
  fontFamily: string
): { x: number; y: number } {
  const value = CARD.value;
  const { ascent, descent } = getValueMetrics(ctx, milestone, fontFamily);
  return {
    x: value.numberCenterX,
    y: value.baselineY - (ascent - descent) / 2,
  };
}

function drawValue(
  ctx: CanvasRenderingContext2D,
  milestone: MilestoneShareImageInput,
  type: MilestoneType,
  fontFamily: string
) {
  const value = CARD.value;
  const valueText = String(milestone.value);
  const valueSize = getValueSize(valueText);
  const valueGradient = ctx.createLinearGradient(
    value.numberCenterX,
    value.baselineY - valueSize * value.gradientTopRatio,
    value.numberCenterX,
    value.baselineY
  );
  valueGradient.addColorStop(0, CARD.colors.white);
  valueGradient.addColorStop(value.gradientMiddleStop, CARD.colors.valueMiddle);
  valueGradient.addColorStop(1, CARD.colors.valueBottom);

  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = CARD.colors.lime;
  ctx.font = font(value.labelWeight, value.labelSize, fontFamily);
  const label = type === "weight" ? value.weightLabel : type === "steps" ? value.stepsLabel : value.daysLabel;
  ctx.fillText(label, value.x, value.labelY);

  ctx.save();
  ctx.direction = "ltr";
  ctx.textAlign = "center";
  ctx.font = font(value.fontWeight, valueSize, fontFamily);
  ctx.fillStyle = valueGradient;
  ctx.shadowColor = value.shadowColor;
  ctx.shadowBlur = value.shadowBlur;
  ctx.shadowOffsetY = value.shadowOffsetY;
  ctx.fillText(valueText, value.numberCenterX, value.baselineY);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.restore();

  drawGlassValue(ctx, valueText, valueSize, valueGradient, value.numberCenterX, value.baselineY, fontFamily);

  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.font = font(CARD.unit.fontWeight, CARD.unit.fontSize, fontFamily);
  ctx.fillStyle = CARD.colors.lime;
  ctx.fillText(milestone.suffix, CARD.unit.x, CARD.unit.baselineY);
}

function drawCopy(
  ctx: CanvasRenderingContext2D,
  firstName: string | undefined,
  fontFamily: string
) {
  const copy = CARD.copy;
  ctx.direction = "rtl";
  ctx.textAlign = "right";

  if (!firstName) return;

  const text = `${copy.firstNamePrefix} ${firstName}`;
  let size = copy.firstNameSize;

  ctx.font = font(copy.firstNameWeight, size, fontFamily);
  let width = ctx.measureText(text).width;
  while (width > copy.maxWidth && size > 28) {
    size -= 2;
    ctx.font = font(copy.firstNameWeight, size, fontFamily);
    width = ctx.measureText(text).width;
  }

  ctx.fillStyle = createTextSplitGradient(ctx, text, copy.firstNameY, size);
  ctx.fillText(text, copy.x, copy.firstNameY);
}

function drawBrand(ctx: CanvasRenderingContext2D, fontFamily: string) {
  const brand = CARD.brand;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = CARD.colors.date;
  ctx.font = font(brand.dateWeight, brand.dateSize, fontFamily);
  const date = new Date().toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  ctx.fillText(date, brand.x, brand.dateY);
}

export async function generateMilestoneShareImage(
  milestone: MilestoneShareImageInput,
  options: MilestoneShareImageOptions = {}
): Promise<Blob> {
  const fontFamily = resolveFontFamily();
  await document.fonts.ready;
  try {
    await Promise.all(CARD.fontLoads.map(({ weight, size, sample }) =>
      document.fonts.load(font(weight, size, fontFamily), sample)
    ));
  } catch {}

  const canvas = document.createElement("canvas");
  canvas.width = CARD.canvas.width;
  canvas.height = CARD.canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");

  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const type = getMilestoneType(milestone);
  const valueCenter = getValueCenter(ctx, milestone, fontFamily);
  drawBackgroundBase(ctx);
  drawCut(ctx, valueCenter);
  drawBackgroundTexture(ctx);
  drawBadge(ctx, fontFamily);
  drawValue(ctx, milestone, type, fontFamily);
  drawCopy(ctx, options.firstName?.trim() || undefined, fontFamily);
  drawBrand(ctx, fontFamily);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to create milestone image"));
    }, "image/png");
  });
}
