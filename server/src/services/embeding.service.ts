import { GoogleGenAI } from "@google/genai";
import { Chunk } from "../types/chunk.type";
import type { EmbeddedChunk } from "../types/embed.type";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});

export function buildBatch(chunks: Chunk[]) {
  const MAX_BATCH_TOKENS = 12000;
  const MAX_BATCH_CHUNKS = 90;
  let currentBatch: Chunk[] = [];
  const finishedBatch = [];
  let currentTotal = 0;
  chunks.forEach((chunk) => {
    const tokens = chunk.content.length / 4;
    if (tokens > MAX_BATCH_TOKENS) {
      throw new ApiError(
        422,
        "This repo cannot be processed by our system, wait for our future updates to handle bigger repos",
      );
    }
    if (
      currentTotal + tokens > MAX_BATCH_TOKENS ||
      currentBatch.length + 1 > MAX_BATCH_CHUNKS
    ) {
      finishedBatch.push(currentBatch);
      currentBatch = [chunk];
      currentTotal = 0;
      currentBatch.forEach((ch) => (currentTotal += ch.content.length / 4));
    } else {
      currentBatch.push(chunk);
      currentTotal += tokens;
    }
  });
  if (currentBatch.length > 0) finishedBatch.push(currentBatch);
  return finishedBatch;
}

export const embedChunk = async (chunks: Chunk[]): Promise<EmbeddedChunk[]> => {
  const results: EmbeddedChunk[] = [];
  const batchArr = buildBatch(chunks);
  const TOKEN_BUDGET = 14000;
  let tokenThisMinute = 0;
  for (let i = 0; i < batchArr.length; i++) {
    let retryCounter = 0;
    const batch = batchArr[i];
    let batchTokens = 0;
    batch.forEach((ch) => (batchTokens += ch.content.length / 4));
    if (tokenThisMinute + batchTokens > TOKEN_BUDGET) {
      console.log(
        `TokenthisMinute:${tokenThisMinute},batchTokens:${batchTokens}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
      tokenThisMinute = 0;
    }
    tokenThisMinute += batchTokens;
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
          throw new ApiError(
            503,
            "Something went wrong and embedding failed try again in a few minutes.",
          );
        }
        const violations = foundObject.violations;
        if (violations.some((item: any) => item.quotaId.includes("PerDay")))
          throw new ApiError(
            429,
            "The daily embedding quota is used up and resets at midnight Pacific time",
          );
        console.warn("Failed to embed batch:", i, e);
        retryCounter++;
        if (retryCounter > 2)
          throw new ApiError(
            503,
            "Something went wrong and embedding failed try again in a few minutes.",
          );
        const foundRetryInfoObject = details.find((obj: any) =>
          obj["@type"].includes("RetryInfo"),
        );
        if (!foundRetryInfoObject) {
          console.error(e.message);
          throw new ApiError(
            503,
            "Something went wrong and embedding failed try again in a few minutes.",
          );
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
