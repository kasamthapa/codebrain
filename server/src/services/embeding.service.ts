import { GoogleGenAI } from "@google/genai";
import { Chunk } from "../types/chunk.type";
import type { EmbeddedChunk } from "../types/embed.type";
import { env } from "../config/env";

const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

export const embedChunk = async (chunks: Chunk[]): Promise<EmbeddedChunk[]> => {
  const results: EmbeddedChunk[] = [];

  for (let i = 0; i < chunks.length; i += 10) {
    const batch = chunks.slice(i, i + 10);
    const contents = batch.map((chunk) => chunk.content);

    try {
      const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents,
        config: {
          outputDimensionality: 768,
        },
      });

      const embeddings = response.embeddings;

      if (!embeddings || embeddings.length !== batch.length) {
        console.warn("Invalid embedding response");
        continue;
      }

      console.log(`Embedded batch of ${batch.length} chunks`);

      for (let j = 0; j < batch.length; j++) {
        const embedding = embeddings[j].values;

        if (!embedding) continue;

        results.push({
          ...batch[j],
          embedding,
        });
      }
    } catch (e) {
      console.warn("Failed to embed batch:", e);
    }
  }

  return results;
};
