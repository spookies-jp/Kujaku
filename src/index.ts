import { getComment, getPost } from "./esaClient";
import { unfurl } from "./slackClient";
import type {
  Env,
  SlackWebhookPayload,
  UnfurlAttachment,
  SlackEventCallbackPayload,
} from "./types";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchEsaUrl(
  url: string,
  teamName: string,
): { postNumber: string; commentNumber: string | null } | null {
  const team = escapeRegExp(teamName);

  const commentMatch = url.match(
    new RegExp(`^https://${team}\\.esa\\.io/posts/(\\d+)#comment-(\\d+).*$`),
  );
  if (commentMatch) {
    return { postNumber: commentMatch[1]!, commentNumber: commentMatch[2]! };
  }

  const postMatch = url.match(
    new RegExp(`^https://${team}\\.esa\\.io/posts/(\\d+).*$`),
  );
  if (postMatch) {
    return { postNumber: postMatch[1]!, commentNumber: null };
  }

  return null;
}

async function handleEventCallback(
  env: Env,
  payload: SlackEventCallbackPayload,
): Promise<void> {
  const { channel, message_ts, links } = payload.event;

  const unfurls: Record<string, UnfurlAttachment> = {};
  for (const link of links) {
    const match = matchEsaUrl(link.url, env.ESA_TEAM_NAME);
    if (!match) continue;

    const attachment = match.commentNumber
      ? await getComment(env, match.postNumber, match.commentNumber)
      : await getPost(env, match.postNumber);

    if (attachment) unfurls[link.url] = attachment;
  }

  await unfurl(env, channel, message_ts, unfurls);
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    console.log("[START]");
    const payload = (await request.json()) as SlackWebhookPayload;

    if (payload.type === "url_verification") {
      return Response.json({ challenge: payload.challenge });
    }

    if (payload.type === "event_callback") {
      await handleEventCallback(env, payload as SlackEventCallbackPayload);
    }

    return Response.json({});
  },
} satisfies ExportedHandler<Env>;
