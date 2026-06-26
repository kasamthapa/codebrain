import db from "../lib/db";
import { retrievalReturnType } from "../types/chunk.type";

export const retrieveChunks = async (
  question: string,
  repoUrl: string,
): Promise<Array<retrievalReturnType>> => {
  try {
    const response = await fetch("http://localhost:11434/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "nomic-embed-text",
        prompt: question,
      }),
    });
    const data = await response.json();
    const embeddedQuestion = data.embedding;
    if (!embeddedQuestion) throw new Error(`Invalid question embeding`);
    const chunks = await db.query(
      `SELECT content,"filePath","startLine","endLine" FROM chunk WHERE "repoUrl"=$1 ORDER BY embedding <=> $2 LIMIT 5`,
      [repoUrl, `[${embeddedQuestion.join(",")}]`],
    );

    return chunks.rows;
  } catch (e) {
    console.warn(`Failed to retireive data`, e);
  }
};
