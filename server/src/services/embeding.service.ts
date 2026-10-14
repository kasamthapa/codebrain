import { GoogleGenAI } from "@google/genai";
import { Chunk } from "../types/chunk.type";
import type { EmbeddedChunk } from "../types/embed.type";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

export const embedChunk = async (chunks: Chunk[]): Promise<EmbeddedChunk[]> => {
  const results: EmbeddedChunk[] = [];

  for (let i = 0; i < chunks.length; i += 10) {
    let retryCounter = 0;
    const batch = chunks.slice(i, i + 10);
    const contents = batch.map((chunk) => chunk.content);
    while (retryCounter <= 2) {
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
          console.warn("Invalid embedding response, batch:", i);
          throw new ApiError(
            502,
            `Embedings error and embedded upto batch:${i}`,
          );
        }

        console.log(`Embedded batch:${i} of ${batch.length} chunks`);

        for (let j = 0; j < batch.length; j++) {
          const embedding = embeddings[j].values;

          if (!embedding)
            throw new ApiError(
              502,
              `Embeding failed on chunk:${j} of batch: ${i}`,
            );

          results.push({
            ...batch[j],
            embedding,
          });
        }
        break;
      } catch (e: any) {
        if (e.status !== 429) {
          throw e;
        }

        const parsedError = JSON.parse(e.message);
        const searchTerm = "QuotaFailure";
        const details = parsedError?.error?.details ?? [];
        const foundObject = details.find((obj: any) =>
          obj["@type"].includes(searchTerm),
        );
        if (!foundObject) {
          console.error(e.message);
          throw e;
        }
        const violations = foundObject.violations;
        if (violations.some((item: any) => item.quotaId.includes("PerDay")))
          throw new ApiError(
            429,
            "The daily embedding quota is used up and resets at midnight Pacific time",
          );
        console.warn("Failed to embed batch:", i, e);
        retryCounter++;
        if (retryCounter > 2) throw e;
        const foundRetryInfoObject = details.find((obj: any) =>
          obj["@type"].includes("RetryInfo"),
        );
        if (!foundRetryInfoObject) {
          console.error(e.message);
          throw e;
        }
        const retryDelay = parseFloat(foundRetryInfoObject.retryDelay);
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * 1000 + 5000),
        );
      }
    }
  }

  return results;
};
