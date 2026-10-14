import { ApiError } from "../utils/ApiError";
import { Request, Response } from "express";
import { fetchRepoFiles } from "../services/github.service";
import { chunkCode } from "../services/chunking.service";
import { embedChunk } from "../services/embeding.service";
import { isIndexed, Storage } from "../services/storage.service";

import { retrieveChunks } from "../services/retrieval.service";
import { llmService } from "../services/llm.service";
import { ApiResponse } from "../utils/ApiResponse";

const MAX_CHUNKS = 900;
export const indexController = async (req: Request, res: Response) => {
  const { repoUrl } = req.body;
  if (!repoUrl) throw new ApiError(401, "repoUrl is missing");
  if (await isIndexed(repoUrl)) {
    res.json(new ApiResponse(200, "Repo already indexed ", {}));
    return;
  }
  const files = await fetchRepoFiles(repoUrl);
  const chunks = files.flatMap((f) =>
    chunkCode(f.content, f.path, f.extension),
  );
  if (chunks.length === 0)
    throw new ApiError(
      422,
      "No supported code files were found in this repository, so there was nothing to index.",
    );
  if (chunks.length > MAX_CHUNKS)
    throw new ApiError(
      422,
      "this repo is too big to be indexed,try a smaller one",
    );
  const embededChunks = await embedChunk(chunks);
  await Storage(embededChunks, repoUrl);
  res.json(new ApiResponse(200, "Repo indexed successfully", {}));
};
export const userQueryController = async (req: Request, res: Response) => {
  console.log(req.body.repoUrl);
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
