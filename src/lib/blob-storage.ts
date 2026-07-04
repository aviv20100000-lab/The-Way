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
