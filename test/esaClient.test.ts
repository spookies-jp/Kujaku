import { afterEach, describe, expect, it, vi } from "vitest";
import { getComment, getPost } from "../src/esaClient";
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
    SENTRY_DSN: "",
  };
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getPost", () => {
  it("builds an unfurl attachment from the esa API response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        full_name: "category/post title",
        wip: false,
        url: "https://myteam.esa.io/posts/123",
        body_md: "line1\nline2\nline3",
        updated_at: "2024-01-01T00:00:00Z",
        created_by: { screen_name: "alice", icon: "alice-icon" },
        updated_by: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const env = makeEnv();
    const result = await getPost(env, "123");

    expect(result).toEqual({
      title: "category/post title",
      title_link: "https://myteam.esa.io/posts/123",
      author_name: "alice",
      author_icon: "alice-icon",
      text: "line1\nline2\nline3",
      color: "#3E8E89",
      footer: "Created by alice",
      ts: Math.floor(new Date("2024-01-01T00:00:00Z").getTime() / 1000),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("prefixes the title with [WIP] for a work-in-progress post", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          full_name: "draft post",
          wip: true,
          url: "https://myteam.esa.io/posts/999",
          body_md: "body",
          updated_at: "2024-01-01T00:00:00Z",
          created_by: { screen_name: "bob", icon: "bob-icon" },
          updated_by: null,
        }),
      ),
    );

    const result = await getPost(makeEnv(), "999");
    expect(result?.title).toBe("[WIP] draft post");
  });

  it("prefers the updater's name in the footer when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          full_name: "post",
          wip: false,
          url: "https://myteam.esa.io/posts/1",
          body_md: "body",
          updated_at: "2024-01-01T00:00:00Z",
          created_by: { screen_name: "alice", icon: "a" },
          updated_by: { screen_name: "carol", icon: "c" },
        }),
      ),
    );

    const result = await getPost(makeEnv(), "1");
    expect(result?.footer).toBe("Updated by carol");
  });

  it("returns null when the esa API has no post for that number", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null, false)));
    expect(await getPost(makeEnv(), "404")).toBeNull();
  });

  it("returns the cached result without calling the esa API again", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        full_name: "post",
        wip: false,
        url: "https://myteam.esa.io/posts/1",
        body_md: "body",
        updated_at: "2024-01-01T00:00:00Z",
        created_by: { screen_name: "alice", icon: "a" },
        updated_by: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const env = makeEnv();
    await getPost(env, "1");
    await getPost(env, "1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("getComment", () => {
  it("builds an unfurl attachment for a comment found in the post's comment list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          full_name: "post title",
          wip: false,
          url: "https://myteam.esa.io/posts/123",
          body_md: "post body",
          updated_at: "2024-01-01T00:00:00Z",
          created_by: { screen_name: "alice", icon: "a" },
          updated_by: null,
          comments: [
            {
              id: 456,
              url: "https://myteam.esa.io/posts/123#comment-456",
              body_md: "comment body",
              updated_at: "2024-02-01T00:00:00Z",
              created_by: { screen_name: "bob", icon: "b" },
              updated_by: null,
            },
          ],
        }),
      ),
    );

    const result = await getComment(makeEnv(), "123", "456");
    expect(result).toMatchObject({
      title: "post title へのコメント",
      title_link: "https://myteam.esa.io/posts/123#comment-456",
      author_name: "bob",
      text: "comment body",
      footer: "Created by bob",
    });
  });

  it("falls back to a direct comment lookup when not in the post's comment list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          full_name: "post title",
          wip: false,
          url: "https://myteam.esa.io/posts/123",
          body_md: "post body",
          updated_at: "2024-01-01T00:00:00Z",
          created_by: { screen_name: "alice", icon: "a" },
          updated_by: null,
          comments: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 789,
          url: "https://myteam.esa.io/posts/123#comment-789",
          body_md: "direct comment body",
          updated_at: "2024-02-01T00:00:00Z",
          created_by: { screen_name: "carol", icon: "c" },
          updated_by: null,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getComment(makeEnv(), "123", "789");
    expect(result?.author_name).toBe("carol");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when the comment cannot be found anywhere", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          full_name: "post",
          wip: false,
          url: "https://myteam.esa.io/posts/123",
          body_md: "body",
          updated_at: "2024-01-01T00:00:00Z",
          created_by: { screen_name: "alice", icon: "a" },
          updated_by: null,
          comments: [],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(null, false));
    vi.stubGlobal("fetch", fetchMock);

    expect(await getComment(makeEnv(), "123", "999")).toBeNull();
  });
});
