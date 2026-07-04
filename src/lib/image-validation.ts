/**
 * Magic-byte validation for the four image formats accepted by the app.
 *
 * Multipart Content-Type headers are user-controlled, so we read the
 * actual first bytes of the file and confirm they match the claimed type.
 * This is an early-rejection defence-in-depth layer — not a substitute
 * for the MIME-type check already in place, but a complement to it.
 *
 * Signatures:
 *   JPEG  → FF D8 FF
 *   PNG   → 89 50 4E 47 (‌\x89PNG)
 *   GIF   → 47 49 46 38 (GIF8)
 *   WebP  → 52 49 46 46 ?? ?? ?? ?? 57 45 42 50 (RIFF????WEBP)
 */
export function validateImageMagicBytes(buffer: Buffer, claimedType: string): boolean {
  if (buffer.length < 12) return false;

  switch (claimedType) {
    case "image/jpeg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

    case "image/png":
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );

    case "image/gif":
      // GIF87a or GIF89a
      return (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38
      );

    case "image/webp":
      // RIFF at bytes 0-3, WEBP at bytes 8-11
      return (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      );

    default:
      return false;
  }
}
