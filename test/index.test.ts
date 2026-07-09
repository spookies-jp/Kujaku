import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { createFakeKv } from "./fakeKv";
import type { Env } from "../src/types";

function makeEnv(): Env {
  return {
    UNFURL_CACHE: createFakeKv(),
    ESA_TEAM_NAME: "myteam",
    ESA_MAX_ARTICLE_LINES: "10",
    ESA_MAX_COMMENT_LINES: "10",
    SLACK_OAUTH_ACCESS_TOKEN: "slack-token",
    ESA_ACCESS_TOKEN: "esa-token",
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetch handler", () => {
  it("echoes back the challenge for a url_verification request", async () => {
    const request = new Request("https://worker.example/", {
      method: "POST",
      body: JSON.stringify({ type: "url_verification", challenge: "abc123" }),
    });

    const response = await worker.fetch(request, makeEnv(), {} as ExecutionContext);
    expect(await response.json()).toEqual({ challenge: "abc123" });
  });

  it("unfurls a matching esa link and calls Slack chat.unfurl", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("api.esa.io")) {
        return {
          ok: true,
          json: async () => ({
            full_name: "post title",
            wip: false,
            url: "https://myteam.esa.io/posts/123",
            body_md: "body",
            updated_at: "2024-01-01T00:00:00Z",
            created_by: { screen_name: "alice", icon: "a" },
            updated_by: null,
          }),
        } as Response;
      }
      return { ok: true, text: async () => "{}" } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://worker.example/", {
      method: "POST",
      body: JSON.stringify({
        type: "event_callback",
        event: {
          channel: "C123",
          message_ts: "1700000000.000100",
          links: [{ url: "https://myteam.esa.io/posts/123" }],
        },
      }),
    });

    const response = await worker.fetch(request, makeEnv(), {} as ExecutionContext);
    expect(await response.json()).toEqual({});

    const slackCall = fetchMock.mock.calls.find(([input]) =>
      (typeof input === "string" ? input : input.toString()).includes("slack.com"),
    );
    expect(slackCall).toBeDefined();
    const slackBody = JSON.parse((slackCall![1] as RequestInit).body as string);
    expect(slackBody.channel).toBe("C123");
    expect(slackBody.ts).toBe("1700000000.000100");
    expect(Object.keys(slackBody.unfurls)).toEqual([
      "https://myteam.esa.io/posts/123",
    ]);
  });

  it("rejects non-POST requests", async () => {
    const request = new Request("https://worker.example/", { method: "GET" });
    const response = await worker.fetch(request, makeEnv(), {} as ExecutionContext);
    expect(response.status).toBe(405);
  });
});
