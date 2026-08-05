type PushErrorLike = {
  statusCode?: unknown;
  message?: unknown;
};

export function getPushStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return null;
  const statusCode = Number((error as PushErrorLike).statusCode);
  return Number.isInteger(statusCode) ? statusCode : null;
}

export function isExpiredPushSubscription(error: unknown): boolean {
  const statusCode = getPushStatusCode(error);
  return statusCode === 404 || statusCode === 410;
}

export function logPushFailure(context: string, error: unknown): void {
  const statusCode = getPushStatusCode(error);
  const message = error instanceof Error ? error.message : "unknown push error";
  console.error(`[${context}]`, { statusCode, message });
}
