import { vi, describe, test, expect, beforeEach } from "vitest";
import { retrieveChunks } from "../services/retrieval.service";

const mockEmbedContent = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    embeddings: [{ values: [0.1, 0.2] }],
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
const dbMock = vi.hoisted(() => {
  return vi.fn();
});
vi.mock("../lib/db.ts", () => {
  const db = {
    query: dbMock,
  };
  return { default: db };
});

describe("retrieval service", () => {
  beforeEach(() => {
    mockEmbedContent.mockClear();
    dbMock.mockClear();
  });
  test("returns rows from db on successful embeding and query ", async () => {
    dbMock.mockResolvedValueOnce({
      rows: [
        {
          content: "function hello() {}",
          filePath: "src/index.ts",
          startLine: 1,
          endLine: 3,
        },
      ],
    });
    const result = await retrieveChunks(
      "how does auth work?",
      "https://github.com/kasamthapa/codebrain",
    );
    expect(result).toEqual([
      {
        content: "function hello() {}",
        filePath: "src/index.ts",
        startLine: 1,
        endLine: 3,
      },
    ]);
    expect(dbMock).toHaveBeenCalledTimes(1);
  });
  test("returns empty array when embedding values are undefined", async () => {
    mockEmbedContent.mockResolvedValueOnce({
      embeddings: [{ values: undefined }],
    });
    const result = await retrieveChunks(
      "how does auth work?",
      "https://github.com/kasamthapa/codebrain",
    );
    expect(result).toEqual([]);
    expect(dbMock).not.toHaveBeenCalled();
  });
  test("returns empty array when embedding API throws", async () => {
    mockEmbedContent.mockRejectedValueOnce(new Error("API failed"));

    const result = await retrieveChunks(
      "how does auth work?",
      "https://github.com/kasamthapa/codebrain",
    );
    expect(result).toEqual([]);
    expect(dbMock).not.toHaveBeenCalled();
  });
  test("returns empty array when db query throws", async () => {
    dbMock.mockRejectedValueOnce(new Error("query failed"));
    const result = await retrieveChunks(
      "how does auth work?",
      "https://github.com/kasamthapa/codebrain",
    );
    expect(result).toEqual([]);
  });
});
