import { describe, expect, it } from "vitest";
import { matchEsaUrl } from "../src/index";

describe("matchEsaUrl", () => {
  it("matches a post URL", () => {
    expect(matchEsaUrl("https://myteam.esa.io/posts/123", "myteam")).toEqual({
      postNumber: "123",
      commentNumber: null,
    });
  });

  it("matches a comment URL", () => {
    expect(
      matchEsaUrl("https://myteam.esa.io/posts/123#comment-456", "myteam"),
    ).toEqual({ postNumber: "123", commentNumber: "456" });
  });

  it("ignores a URL from a different esa team", () => {
    expect(matchEsaUrl("https://otherteam.esa.io/posts/123", "myteam")).toBeNull();
  });

  it("ignores a non-esa URL", () => {
    expect(matchEsaUrl("https://example.com/posts/123", "myteam")).toBeNull();
  });
});
