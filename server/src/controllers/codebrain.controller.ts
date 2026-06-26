import { ApiError } from "../utils/ApiError";
import { Request, Response } from "express";
import { fetchRepoFiles } from "../services/github.service";
import { chunkCode } from "../services/chunking.service";
import { embedChunk } from "../services/embeding.service";
import { Storage } from "../services/storage.service";

import { retrieveChunks } from "../services/retrieval.service";
import { llmService } from "../services/llm.service";
import { ApiResponse } from "../utils/ApiResponse";

export const indexController = async (req: Request, res: Response) => {
  const { repoUrl } = req.body;
  if (!repoUrl) throw new ApiError(401, "repoUrl is missing");
  const files = await fetchRepoFiles(repoUrl);
  const chunks = files.flatMap((f) =>
    chunkCode(f.content, f.path, f.extension),
  );
  const embededChunks = await embedChunk(chunks);
  await Storage(embededChunks, repoUrl);
  res.json(new ApiResponse(200, "Repo indexed successfully", {}));
};
export const userQueryController = async (req: Request, res: Response) => {
  const { repoUrl, question } = req.body;
  if (!repoUrl || !question)
    throw new ApiError(401, "repoUrl or question is missing");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const similarChunks = await retrieveChunks(question, repoUrl);
  if (similarChunks.length === 0) {
    res.write("data: No relevant code found for this question\n\n");
    res.end();
    return;
  }
  await llmService(question, similarChunks, res);
};
