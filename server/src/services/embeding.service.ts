import { Chunk } from "../types/chunk.type";
import { GoogleGenAI } from "@google/genai";
import type { EmbeddedChunk } from "../types/embed.type";
const ai = new GoogleGenAI({});
export const embedChunk = async (
  chunks: Chunk[],
): Promise<Array<EmbeddedChunk>> => {
  const results: EmbeddedChunk[] = [];
  for (let i = 0; i < chunks.length; i = i + 10) {
    const chunk = chunks.slice(i, i + 10);
    await Promise.all(
      chunk.map(async (chunk) => {
        try {
          const content = chunk.content;
          const response = await ai.models.embedContent({
            model: "gemini-embedding-001",
            contents: content,
            config: {
              outputDimensionality: 768,
            },
          });
          const values = response.embeddings?.[0].values ?? [];
          results.push({ ...chunk, embedding: values });
        } catch (e) {
          console.warn(`Failed to embed chunk from ${chunk.filePath}:`, e);
        }
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 7000));
  }
  return results;
};
