import { describe, expect, it } from "vitest";
import { commentCacheKey, getCached, postCacheKey, setCached } from "../src/cache";
import { createFakeKv } from "./fakeKv";
import type { UnfurlAttachment } from "../src/types";

const sample: UnfurlAttachment = {
  title: "title",
  title_link: "https://example.esa.io/posts/1",
  author_name: "author",
  author_icon: "icon",
  text: "text",
  color: "#3E8E89",
  footer: "Created by author",
  ts: 0,
};

describe("cache", () => {
  it("returns null on a cache miss", async () => {
    const kv = createFakeKv();
    expect(await getCached(kv, postCacheKey("1"))).toBeNull();
  });

  it("returns the cached value after a set", async () => {
    const kv = createFakeKv();
    await setCached(kv, postCacheKey("1"), sample);
    expect(await getCached(kv, postCacheKey("1"))).toEqual(sample);
  });

  it("keeps post and comment cache keys distinct", () => {
    expect(postCacheKey("1")).not.toBe(commentCacheKey("1"));
  });
});
