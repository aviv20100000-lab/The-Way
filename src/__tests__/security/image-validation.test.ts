/**
 * @jest-environment node
 *
 * Tests magic-byte validation for image uploads.
 */

import { validateImageMagicBytes } from "@/lib/image-validation";

// Minimal valid magic bytes for each supported type
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PNG  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const GIF  = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]);
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

// A buffer that starts with plausible-looking HTML (as might be sent by an attacker)
const HTML = Buffer.from("<!DOCTYPE html><html><body>evil</body></html>");

describe("validateImageMagicBytes — correct type detection", () => {
  it("accepts a real JPEG", () => expect(validateImageMagicBytes(JPEG, "image/jpeg")).toBe(true));
  it("accepts a real PNG",  () => expect(validateImageMagicBytes(PNG,  "image/png")).toBe(true));
  it("accepts a real GIF",  () => expect(validateImageMagicBytes(GIF,  "image/gif")).toBe(true));
  it("accepts a real WebP", () => expect(validateImageMagicBytes(WEBP, "image/webp")).toBe(true));
});

describe("validateImageMagicBytes — type mismatch rejection", () => {
  it("rejects JPEG bytes claimed as PNG",  () => expect(validateImageMagicBytes(JPEG, "image/png")).toBe(false));
  it("rejects PNG bytes claimed as JPEG",  () => expect(validateImageMagicBytes(PNG,  "image/jpeg")).toBe(false));
  it("rejects GIF bytes claimed as WebP",  () => expect(validateImageMagicBytes(GIF,  "image/webp")).toBe(false));
  it("rejects WebP bytes claimed as GIF",  () => expect(validateImageMagicBytes(WEBP, "image/gif")).toBe(false));
});

describe("validateImageMagicBytes — non-image content rejection", () => {
  it("rejects HTML content claimed as JPEG",  () => expect(validateImageMagicBytes(HTML, "image/jpeg")).toBe(false));
  it("rejects HTML content claimed as PNG",   () => expect(validateImageMagicBytes(HTML, "image/png")).toBe(false));
  it("rejects HTML content claimed as GIF",   () => expect(validateImageMagicBytes(HTML, "image/gif")).toBe(false));
  it("rejects HTML content claimed as WebP",  () => expect(validateImageMagicBytes(HTML, "image/webp")).toBe(false));
  it("rejects empty buffer",                  () => expect(validateImageMagicBytes(Buffer.alloc(0), "image/jpeg")).toBe(false));
  it("rejects too-short buffer (< 12 bytes)", () => expect(validateImageMagicBytes(Buffer.from([0xff, 0xd8]), "image/jpeg")).toBe(false));
  it("rejects unknown MIME type",             () => expect(validateImageMagicBytes(JPEG, "application/pdf")).toBe(false));
});
