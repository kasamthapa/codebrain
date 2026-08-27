import { beforeEach, describe, expect, test, vi } from "vitest";
import { Storage } from "../services/storage.service";
import { EmbeddedChunk } from "../types/embed.type";

const dbMock = vi.hoisted(() => {
  return vi.fn();
});
vi.mock("../lib/db.ts", () => {
  const db = {
    query: dbMock,
  };
  return { default: db };
});

describe("skips the query insertion if repoUrl already exists", () => {
  beforeEach(() => {
    dbMock.mockClear();
  });
  test("skips the query insertion if repoUrl already exists", async () => {
    dbMock.mockResolvedValueOnce({
      rows: [{}],
    });
    const embededChunks: [] = [];
    const repoUrl = "https://github.com/kasamthapa/codebrain";
    expect(await Storage(embededChunks, repoUrl)).toBeUndefined();
    expect(dbMock).toHaveBeenCalledTimes(1);
  });
  test("insertion query runs succussfully if repoUrl doesnot exists", async () => {
    dbMock.mockResolvedValueOnce({
      rows: [],
    });
    dbMock.mockResolvedValueOnce({});
    const embededChunks: EmbeddedChunk[] = [
      {
        content: `import js from '@eslint/js'
        import globals from 'globals'
        import reactHooks from 'eslint-plugin-react-hooks'
        import reactRefresh from 'eslint-plugin-react-refresh'
        import tseslint from 'typescript-eslint'
        import { defineConfig, globalIgnores } from 'eslint/config'`,
        filePath: "client/eslint.config.js ",
        startLine: 1,
        endLine: 6,
        type: "import",
        extension: "js",
        embedding: [-0.08216766, -0.018323293],
      },
    ];
    const repoUrl = "https://github.com/kasamthapa/codebrain";
    expect(await Storage(embededChunks, repoUrl)).toBeUndefined();
    expect(dbMock).toHaveBeenCalledTimes(2);
  });
});
