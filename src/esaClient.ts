import { commentCacheKey, getCached, postCacheKey, setCached } from "./cache";
import type { Env, UnfurlAttachment } from "./types";

const ESA_API_BASE = "https://api.esa.io/v1";

interface EsaUser {
  screen_name: string;
  icon: string;
}

interface EsaComment {
  id: number;
  url: string;
  body_md: string;
  updated_at: string;
  created_by: EsaUser;
  updated_by: EsaUser | null;
}

interface EsaPost {
  full_name: string;
  wip: boolean;
  url: string;
  body_md: string;
  updated_at: string;
  created_by: EsaUser;
  updated_by: EsaUser | null;
  comments?: EsaComment[];
}

async function esaFetch(env: Env, path: string): Promise<Response> {
  return fetch(`${ESA_API_BASE}/teams/${env.ESA_TEAM_NAME}${path}`, {
    headers: { Authorization: `Bearer ${env.ESA_ACCESS_TOKEN}` },
  });
}

// esa_client.rb の unescape を移植
function unescape(str: string): string {
  return str.replaceAll("&#35;", "#").replaceAll("&#47;", "/");
}

// esa_client.rb の article_text / comment_text を移植
function truncateBody(bodyMd: string, maxLines: number): string {
  return unescape(bodyMd.split("\n").slice(0, maxLines).join("\n"));
}

// esa_client.rb の generate_footer を移植
function generateFooter(
  createdBy: EsaUser | null,
  updatedBy: EsaUser | null,
): string {
  if (updatedBy?.screen_name) {
    return `Updated by ${updatedBy.screen_name}`;
  }
  return `Created by ${createdBy?.screen_name ?? "unknown"}`;
}

export async function getPost(
  env: Env,
  postNumber: string,
): Promise<UnfurlAttachment | null> {
  const cacheKey = postCacheKey(postNumber);
  const cached = await getCached(env.UNFURL_CACHE, cacheKey);
  if (cached) return cached;

  const res = await esaFetch(env, `/posts/${postNumber}`);
  if (!res.ok) return null;
  const post = (await res.json()) as EsaPost;

  const maxLines = Number(env.ESA_MAX_ARTICLE_LINES) || 10;
  const title = post.wip ? `[WIP] ${post.full_name}` : post.full_name;

  const info: UnfurlAttachment = {
    title: unescape(title),
    title_link: post.url,
    author_name: post.created_by.screen_name,
    author_icon: post.created_by.icon,
    text: truncateBody(post.body_md, maxLines),
    color: "#3E8E89",
    footer: generateFooter(post.created_by, post.updated_by),
    ts: Math.floor(new Date(post.updated_at).getTime() / 1000),
  };

  await setCached(env.UNFURL_CACHE, cacheKey, info);
  return info;
}

export async function getComment(
  env: Env,
  postNumber: string,
  commentNumber: string,
): Promise<UnfurlAttachment | null> {
  const cacheKey = commentCacheKey(commentNumber);
  const cached = await getCached(env.UNFURL_CACHE, cacheKey);
  if (cached) return cached;

  const postRes = await esaFetch(env, `/posts/${postNumber}?include=comments`);
  if (!postRes.ok) return null;
  const post = (await postRes.json()) as EsaPost;

  let comment =
    post.comments?.find((c) => c.id === Number(commentNumber)) ?? null;

  if (!comment) {
    const commentRes = await esaFetch(env, `/comments/${commentNumber}`);
    if (!commentRes.ok) return null;
    comment = (await commentRes.json()) as EsaComment;
  }
  if (!comment) return null;

  const maxLines = Number(env.ESA_MAX_COMMENT_LINES) || 10;
  const postName = post.wip ? `[WIP] ${post.full_name}` : post.full_name;

  const info: UnfurlAttachment = {
    title: `${postName} へのコメント`,
    title_link: comment.url,
    author_name: comment.created_by.screen_name,
    author_icon: comment.created_by.icon,
    text: truncateBody(comment.body_md, maxLines),
    color: "#3E8E89",
    footer: generateFooter(comment.created_by, comment.updated_by),
    ts: Math.floor(new Date(comment.updated_at).getTime() / 1000),
  };

  await setCached(env.UNFURL_CACHE, cacheKey, info);
  return info;
}
