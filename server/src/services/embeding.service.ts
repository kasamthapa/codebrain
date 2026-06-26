import { ApiError } from "@google/genai";
import { Chunk } from "../types/chunk.type";
import type { EmbeddedChunk } from "../types/embed.type";

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
          const response = await fetch(
            "http://localhost:11434/api/embeddings",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "nomic-embed-text",
                prompt: content,
              }),
            },
          );
          const data = await response.json();
          console.log(`Chunk size: ${content.length} chars`);
          if (!data.embedding || !Array.isArray(data.embedding)) {
            console.warn("Invalid embedding response:", data);
            return;
          }
          const values = data.embedding;
          results.push({ ...chunk, embedding: values });
        } catch (e) {
          console.warn(`Failed to embed chunk from ${chunk.filePath}:`, e);
        }
      }),
    );
  }
  return results;
};
