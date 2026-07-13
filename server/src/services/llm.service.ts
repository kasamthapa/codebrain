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
  console.log(
    chunks.map((c) => ({
      file: c.filePath,
      lines: `${c.startLine}-${c.endLine}`,
    })),
  );
  try {
    const prompt = `
You are a senior software engineer helping another developer understand a codebase.

You must answer ONLY from the provided code context.

If the answer cannot be determined from the provided code, explicitly say:
"I couldn't find enough information in the retrieved code."

When answering:
- Explain the flow step by step.
- Mention the file names involved.
- Mention line numbers whenever possible.
- Do not invent code or behavior.
- If multiple files work together, explain how they connect.\n

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
      res.write(`data: ${JSON.stringify(token.text)}\n\n`);
    }
    res.end();
  } catch (e) {
    console.warn("LLM service failed:", e);
    res.write("data: Error generating answer\n\n");
    res.end();
  }
};
