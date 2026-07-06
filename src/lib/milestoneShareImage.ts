interface ShareableMilestone {
  value: number;
  suffix: string;
  message: string;
}

interface MilestoneShareImageOptions {
  firstName?: string;
}

const WIDTH = 1080;
const HEIGHT = 1920;

// next/font registers Rubik under an internal family name ("__Rubik_...").
// Canvas can't resolve "Rubik" directly, so read the actual family list from
// the CSS variable set on <html> in layout.tsx.
function resolveFontFamily(): string {
  const fromVariable = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-rubik")
    .trim();
  return fromVariable ? `${fromVariable}, Rubik, sans-serif` : "Rubik, sans-serif";
}

function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  spacing: number
) {
  const characters = [...text];
  const widths = characters.map((character) => ctx.measureText(character).width);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + spacing * (characters.length - 1);
  let x = centerX - totalWidth / 2;

  ctx.textAlign = "left";
  ctx.direction = "ltr";
  characters.forEach((character, index) => {
    ctx.fillText(character, x, y);
    x += widths[index] + spacing;
  });
  ctx.textAlign = "center";
  ctx.direction = "rtl";
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && ctx.measureText(candidate).width > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function generateMilestoneShareImage(
  milestone: ShareableMilestone,
  options: MilestoneShareImageOptions = {}
): Promise<Blob> {
  const fontFamily = resolveFontFamily();
  await document.fonts.ready;
  // fonts.ready doesn't guarantee every weight was fetched — request the ones we draw with.
  try {
    await Promise.all([
      document.fonts.load(`900 300px ${fontFamily}`, "0"),
      document.fonts.load(`700 56px ${fontFamily}`, "אבן דרך"),
      document.fonts.load(`500 38px ${fontFamily}`, "אבן דרך"),
    ]);
  } catch {}

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas is not supported in this browser");

  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, "#0d0f0c");
  background.addColorStop(1, "#171a16");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH / 2, 820, 20, WIDTH / 2, 820, 560);
  glow.addColorStop(0, "rgba(195, 244, 0, 0.11)");
  glow.addColorStop(0.48, "rgba(195, 244, 0, 0.045)");
  glow.addColorStop(1, "rgba(195, 244, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 260, WIDTH, 1120);

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2e3030";
  ctx.beginPath();
  ctx.arc(WIDTH / 2, 825, 420, Math.PI * 0.12, Math.PI * 1.68);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(WIDTH / 2, 825, 495, Math.PI * 0.72, Math.PI * 1.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(WIDTH / 2, 825, 345, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();

  const dots = [
    [126, 380, 6], [922, 475, 4], [188, 940, 4], [910, 1110, 7],
    [248, 1370, 5], [842, 1450, 4], [154, 1570, 3], [946, 1535, 3],
  ] as const;
  ctx.fillStyle = "#c3f400";
  dots.forEach(([x, y, radius]) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#c3f400";
  ctx.font = `700 52px ${fontFamily}`;
  ctx.fillText("אבן דרך חדשה", WIDTH / 2, 250);

  const valueText = String(milestone.value);
  ctx.font = `900 300px ${fontFamily}`;
  const valueWidth = ctx.measureText(valueText).width;
  ctx.font = `700 72px ${fontFamily}`;
  const suffixWidth = ctx.measureText(milestone.suffix).width;
  const gap = 30;
  const groupWidth = valueWidth + suffixWidth + gap;
  const groupLeft = (WIDTH - groupWidth) / 2;

  // Natural Hebrew order: number on the right, unit on the left (matches the in-app modal).
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#c4c9ac";
  ctx.font = `700 72px ${fontFamily}`;
  ctx.fillText(milestone.suffix, groupLeft + suffixWidth / 2, 890);
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 300px ${fontFamily}`;
  ctx.fillText(valueText, groupLeft + suffixWidth + gap, 900);
  ctx.direction = "rtl";
  ctx.textAlign = "center";

  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 56px ${fontFamily}`;
  const messageLines = wrapText(ctx, milestone.message, 850);
  messageLines.forEach((line, index) => {
    ctx.fillText(line, WIDTH / 2, 1110 + index * 78);
  });

  const firstName = options.firstName?.trim();
  if (firstName) {
    ctx.fillStyle = "#8e9379";
    ctx.font = `500 38px ${fontFamily}`;
    ctx.fillText(`הדרך של ${firstName}`, WIDTH / 2, 1325);
  }

  ctx.fillStyle = "#c3f400";
  ctx.font = `700 50px ${fontFamily}`;
  drawSpacedText(ctx, "THE WAY", WIDTH / 2, 1680, 18);

  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#8e9379";
  ctx.font = `500 34px ${fontFamily}`;
  const date = new Date().toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  ctx.fillText(date, WIDTH / 2, 1750);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to create milestone image"));
    }, "image/png");
  });
}
