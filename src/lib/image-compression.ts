/**
 * Image compression utility — reduces file size while maintaining quality
 * Used by food tracking and steps tracking for photo uploads
 */

export async function compressImageToJpeg(
  file: File,
  maxDimension: number = 1200,
  quality: number = 0.82
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      // Resize if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      // Draw to canvas and compress
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

      // Convert to JPEG blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
          } else {
            // Fallback if compression fails
            resolve(file);
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      // Fallback if image fails to load
      resolve(file);
    };

    img.src = URL.createObjectURL(file);
  });
}
