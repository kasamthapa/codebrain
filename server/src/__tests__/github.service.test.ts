import { beforeEach, describe, expect, test, vi } from "vitest";
import { fetchRepoFiles } from "../services/github.service";

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

describe("githubService", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });
  test("returns array of objects with path, content and extension ", async () => {
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

  test("throws error for invalid github repo url", async () => {
    const badCall = async () =>
      await fetchRepoFiles("https://gitlab.com/kasamthapa/codebrain");

    await expect(badCall()).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("throws error for owner or repo undefined in repoUrl", async () => {
    const badCall = async () =>
      await fetchRepoFiles("https://github.com/kasamthapa");

    await expect(badCall()).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
