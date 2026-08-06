/**
 * Image compression utility — reduces file size while maintaining quality
 * Used by food tracking, steps, avatars, and group photos.
 */

function getScaledDimensions(width: number, height: number, maxDimension: number) {
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height / width) * maxDimension);
      width = maxDimension;
    } else {
      width = Math.round((width / height) * maxDimension);
      height = maxDimension;
    }
  }

  return { width, height };
}

function drawToJpeg(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxDimension: number,
  quality: number
): Promise<File> {
  const { width, height } = getScaledDimensions(sourceWidth, sourceHeight, maxDimension);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context unavailable");
  context.drawImage(source, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("JPEG conversion failed"));
          return;
        }
        resolve(new File([blob], "photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      quality
    );
  });
}

async function compressWithImageBitmap(file: File, maxDimension: number, quality: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    return await drawToJpeg(bitmap, bitmap.width, bitmap.height, maxDimension, quality);
  } finally {
    bitmap.close();
  }
}

async function compressWithImageElement(file: File, maxDimension: number, quality: number): Promise<File> {
  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return await drawToJpeg(image, image.width, image.height, maxDimension, quality);
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function compressImageToJpegUnbounded(
  file: File,
  maxDimension: number,
  quality: number
): Promise<File> {
  try {
    if (typeof createImageBitmap === "function") {
      try {
        return await compressWithImageBitmap(file, maxDimension, quality);
      } catch {}
    }

    try {
      return await compressWithImageElement(file, maxDimension, quality);
    } catch {}
  } catch {}

  return file;
}

/**
 * createImageBitmap/Image.decode have no reliable abort and have been
 * observed to hang indefinitely (never resolve, never reject) on a malformed
 * image — with no timeout, every caller was one bad photo away from a
 * spinner stuck forever. Falls back to the original, uncompressed file if
 * compression hasn't finished within `timeoutMs`, same as the ordinary
 * failure fallback above.
 */
export function compressImageToJpeg(
  file: File,
  maxDimension: number = 1200,
  quality: number = 0.82,
  timeoutMs: number = 10000
): Promise<File> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(file);
    }, timeoutMs);
    compressImageToJpegUnbounded(file, maxDimension, quality).then((result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    });
  });
}
