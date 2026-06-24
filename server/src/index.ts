import express from "express";
import { env } from "./config/env";
import { errorMiddleware } from "./middleware/err.middleware";
const app = express();
app.use(errorMiddleware);
app.get("/", (req, res) => {
  res.send("HELLO from home");
});
app.listen(env.PORT, () => {
  console.log(`Server is listenign on  ${env.PORT}`);
});
import { fetchRepoFiles } from "./services/github.service";
import { chunkCode } from "./services/chunking.service";
import { embedChunk } from "./services/embeding.service";
import { Storage } from "./services/storage.service";

const repoUrl = "https://github.com/kasamthapa/critch";
fetchRepoFiles(repoUrl)
  .then((files) => {
    const chunks = files.flatMap((f) =>
      chunkCode(f.content, f.path, f.extension),
    );
    return embedChunk(chunks);
  })
  .then((embedded) => Storage(embedded, repoUrl))
  .then((result) => console.log("Stored:", result.rows.length, "chunks"))
  .catch(console.error);
