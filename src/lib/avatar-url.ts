/**
 * The client never receives a raw blob URL — only this proxy path, which
 * /api/avatar/[userId]/route.ts checks against the viewer's session before
 * streaming the image. Pass the raw DB `avatar_url` value; returns null when
 * there is no avatar to show.
 */
export function toAvatarProxyUrl(userId: string, rawAvatarUrl: string | null | undefined): string | null {
  return rawAvatarUrl ? `/api/avatar/${userId}` : null;
}
