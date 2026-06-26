import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env";
import { retrievalReturnType } from "../types/chunk.type";
import { Response } from "express";
const GEMINI_API_KEY = env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export const llmService = async (
  question: string,
  chunks: retrievalReturnType[],
  res: Response,
) => {
  try {
    const prompt = `
  You are a code assistant. Answer the user's question based only on the provided code chunks. Include file references in your answer.\n

###Context:\n
${chunks
  .map(
    (chunk) =>
      `File:${chunk.filePath}\t(lines\t${chunk.startLine}-${chunk.endLine})
    \`\`\`
    ${chunk.content.trim()}
    \`\`\`
    `,
  )
  .join("\n")}
###Question:
${question}`;
    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    for await (const token of response) {
      res.write(`data: ${token.text}\n\n`);
    }
    res.end();
  } catch (e) {
    console.warn("LLM service failed:", e);
    res.write("data: Error generating answer\n\n");
    res.end();
  }
};
