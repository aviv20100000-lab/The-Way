import { put } from "@vercel/blob";
import { v4 as uuid } from "uuid";

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function uploadMealPhoto(
  imageBuffer: Buffer,
  userId: string,
  contentType: string = "image/jpeg"
): Promise<string> {
  return uploadPhoto(imageBuffer, `meal-photos/${userId}`, contentType);
}

export async function uploadUserAvatar(
  imageBuffer: Buffer,
  targetUserId: string,
  contentType: string = "image/jpeg"
): Promise<string> {
  return uploadPhoto(imageBuffer, `avatars/${targetUserId}`, contentType);
}

export async function uploadGroupPhoto(
  imageBuffer: Buffer,
  groupId: string,
  contentType: string = "image/jpeg"
): Promise<string> {
  return uploadPhoto(imageBuffer, `chat-groups/${groupId}`, contentType);
}

// A meal photo URL is supplied by the client after it uploads, so it must be
// proven to be a blob we issued *for that user* before it is stored on a meal —
// otherwise anyone could attach an arbitrary URL to their own meal row.
export function isOwnMealPhotoUrl(url: string, userId: string): boolean {
  if (typeof url !== "string" || url.length > 500) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return false;
  return parsed.pathname.startsWith(`/meal-photos/${userId}/`);
}

async function uploadPhoto(
  imageBuffer: Buffer,
  pathPrefix: string,
  contentType: string
): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    throw new Error("אחסון התמונות לא מוגדר עדיין. צריך לחבר Vercel Blob לפרויקט.");
  }

  const extension = EXTENSION_BY_TYPE[contentType] ?? "jpg";
  const pathname = `${pathPrefix}/${uuid()}.${extension}`;
  const result = await put(pathname, imageBuffer, {
    access: "public",
    addRandomSuffix: false,
    contentType,
    token,
  });

  return result.url;
}
