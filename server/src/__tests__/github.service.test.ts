import { describe, expect, test, vi } from "vitest";
import { fetchRepoFiles } from "../services/github.service";

const mockFetch = vi.fn();
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: vi.fn().mockResolvedValue({
    tree: [
      {
        path: "src/index.ts",
        type: "blob",
        sha: "abc",
      },
    ],
    truncated: false,
  }),
});
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: vi.fn().mockResolvedValue({
    content: "ZnVuY3Rpb24oKXtsZXQgeD01O30=",
  }),
  headers: {
    get: (key: string) => {
      if (key === "x-ratelimit-remaining") return "5000";
      return null;
    },
  },
});

vi.stubGlobal("fetch", mockFetch);

describe("githubService", () => {
  test("returns array of objects with path, content and extension ", async () => {
    expect(
      await fetchRepoFiles("https://github.com/kasamthapa/codebrain"),
    ).toEqual([
      {
        path: "src/index.ts",
        content: "function(){let x=5;}",
        extension: "ts",
      },
    ]);
  });
});
