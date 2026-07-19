import { vi, describe, test, expect } from "vitest";
import { Chunk } from "../types/chunk.type";
import { embedChunk } from "../services/embeding.service";
import { assert } from "node:console";

const mockEmbedContent = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    embeddings: [{ values: [0.1, 0.2] }, { values: [0.4, 0.7] }],
  }),
);
vi.mock("@google/genai", () => {
  const GoogleGenAI = vi.fn().mockImplementation(function construct() {
    return {
      models: {
        embedContent: mockEmbedContent,
      },
    };
  });
  return { GoogleGenAI };
});

describe("embedChunk", () => {
  const chunk1: Chunk = {
    content: "function a() {}",
    filePath: "/file.ts",
    startLine: 1,
    endLine: 1,
    type: "function",
    extension: "ts",
  };
  const chunk2: Chunk = {
    content: "function a() {}",
    filePath: "/file.ts",
    startLine: 3,
    endLine: 4,
    type: "function",
    extension: "ts",
  };
  test("returns chunks with embeddings attached", async () => {
    const results = await embedChunk([chunk1, chunk2]);
    expect(results).toEqual([
      { ...chunk1, embedding: [0.1, 0.2] },
      { ...chunk2, embedding: [0.4, 0.7] },
    ]);
  });

  test("returns empty result for no chunks provided", async () => {
    expect(await embedChunk([])).toEqual([]);
  });

  test("throw error for embeddings not matching length of batch", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: [0.1, 0.2] }],
    });
    expect(await embedChunk([chunk1, chunk2])).toEqual([]);
  });

  test("throws error for any problem in try block", async () => {
    mockEmbedContent.mockRejectedValueOnce(new Error("API failed"));
    expect(await embedChunk([chunk1, chunk2])).toEqual([]);
  });

  test("skips the embedding if undefined ", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: [0.1, 0.2] }, { values: undefined }],
    });
    expect(await embedChunk([chunk1, chunk2])).toEqual([
      { ...chunk1, embedding: [0.1, 0.2] },
    ]);
  });
});
