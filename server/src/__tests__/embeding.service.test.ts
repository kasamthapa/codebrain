import { vi, describe, test, expect } from "vitest";
import { Chunk } from "../types/chunk.type";
import { embedChunk } from "../services/embeding.service";

vi.mock("@google/genai", () => {
  const GoogleGenAI = vi.fn().mockImplementation(function construct() {
    return {
      models: {
        embedContent: vi.fn().mockResolvedValue({
          embeddings: [{ values: [0.1, 0.2] }, { values: [0.4, 0.7] }],
        }),
      },
    };
  });
  return { GoogleGenAI };
});

describe("embedChunk", () => {
  test("returns chunks with embeddings attached", async () => {
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
    const results = await embedChunk([chunk1, chunk2]);
    expect(results).toEqual([
      { ...chunk1, embedding: [0.1, 0.2] },
      { ...chunk2, embedding: [0.4, 0.7] },
    ]);
  });
});
