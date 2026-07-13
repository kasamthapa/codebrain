import { GoogleGenAI } from "@google/genai";
import db from "../lib/db";
import { retrievalReturnType } from "../types/chunk.type";
import { env } from "../config/env";
const ai = new GoogleGenAI({
  apiKey: env.GEMINI_API_KEY,
});
export const retrieveChunks = async (
  question: string,
  repoUrl: string,
): Promise<Array<retrievalReturnType>> => {
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: [question],
      config: {
        outputDimensionality: 768,
      },
    });

    const embeddedQuestion = response.embeddings?.[0].values;
    if (!embeddedQuestion) throw new Error(`Invalid question embeding`);
    const chunks = await db.query(
      `SELECT content,"filePath","startLine","endLine" FROM chunk WHERE "repoUrl"=$1 ORDER BY embedding <=> $2 LIMIT 5`,
      [repoUrl, `[${embeddedQuestion.join(",")}]`],
    );

    return chunks.rows;
  } catch (e) {
    console.warn(`Failed to retrieve data`, e);
    return [];
  }
};
