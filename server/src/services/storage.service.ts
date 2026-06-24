import db from "../lib/db";
import type { EmbeddedChunk } from "../types/embed.type";

export const Storage = async (data: EmbeddedChunk[], repoUrl: string) => {
  const isRepoPresent = await db.query(
    `SELECT "repoUrl" FROM chunk WHERE "repoUrl"=$1`,
    [repoUrl],
  );
  if (isRepoPresent.rows.length > 0) {
    return await db.query(`SELECT * FROM chunk WHERE "repoUrl"=$1`, [repoUrl]);
  }
  const placeholders = [];
  const values = [];
  data.forEach((chunk, index) => {
    const offset = index * 8;
    placeholders.push(
      `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8})`,
    );
    values.push(
      repoUrl,
      chunk.content,
      chunk.type,
      chunk.filePath,
      chunk.startLine,
      chunk.endLine,
      chunk.extension,
      `[${chunk.embedding.join(",")}]`,
    );
  });
  await db.query(
    `INSERT INTO chunk("repoUrl", "content","type","filePath", "startLine","endLine","extension", "embedding")VALUES ${placeholders.join(",")}`,
    values,
  );
  const result = await db.query(`SELECT * FROM chunk`);
  return result;
};
