import type { Env, UnfurlAttachment } from "./types";

const SLACK_UNFURL_ENDPOINT = "https://slack.com/api/chat.unfurl";

export async function unfurl(
  env: Env,
  channel: string,
  ts: string,
  unfurls: Record<string, UnfurlAttachment>,
): Promise<void> {
  const res = await fetch(SLACK_UNFURL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${env.SLACK_OAUTH_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ channel, ts, unfurls }),
  });
  console.log("[LOG] slack response:", await res.text());
}
