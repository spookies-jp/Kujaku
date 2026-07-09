import type { UnfurlAttachment } from "./types";

// Redis実装の REDIS_TTL / FIRE_STORE_TTL (1時間) を踏襲する
const CACHE_TTL_SECONDS = 60 * 60;

export function postCacheKey(postNumber: string): string {
  return `post-${postNumber}`;
}

export function commentCacheKey(commentNumber: string): string {
  return `comment-${commentNumber}`;
}

export async function getCached(
  kv: KVNamespace,
  key: string,
): Promise<UnfurlAttachment | null> {
  return kv.get<UnfurlAttachment>(key, "json");
}

export async function setCached(
  kv: KVNamespace,
  key: string,
  info: UnfurlAttachment,
): Promise<void> {
  await kv.put(key, JSON.stringify(info), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
}
